"""AI calls: Groq Whisper (speech) + Gemini (vision). Demo fallbacks keep the app usable without keys."""
import hashlib
import logging
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from . import config
from .prompts import COMPARE_PROMPT, DETECT_PROMPT, ISSUE_TYPES, ITEMS, SEVERITIES, WHISPER_HINT

log = logging.getLogger("wapas.ai")

SEVERITY_RANK = {s: i for i, s in enumerate(SEVERITIES)}


# ---------- schemas Gemini must follow ----------
class AIIssue(BaseModel):
    item: str
    issue_type: str
    severity: str
    description: str
    frame_ts: float
    source: str
    voice_quote: str
    confidence: float


class AIRoom(BaseModel):
    issues: list[AIIssue]


class AIVerdict(BaseModel):
    move_out_issue_id: str
    move_in_issue_id: str
    verdict: str
    reason: str


class AICompare(BaseModel):
    verdicts: list[AIVerdict]


def _pick(value: str, allowed: list[str], fallback: str) -> str:
    v = (value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return v if v in allowed else fallback


def normalize_issue(raw: dict, duration: float) -> dict:
    ts = float(raw.get("frame_ts") or 0)
    if duration > 0:
        ts = max(0.0, min(ts, duration))
    return {
        "item": _pick(raw.get("item"), ITEMS, "other"),
        "issue_type": _pick(raw.get("issue_type"), ISSUE_TYPES, "other"),
        "severity": _pick(raw.get("severity"), SEVERITIES, "minor"),
        "description": (raw.get("description") or "Condition issue").strip()[:160],
        "frame_ts": round(ts, 1),
        "source": _pick(raw.get("source"), ["vision", "voice", "both"], "vision"),
        "voice_quote": (raw.get("voice_quote") or "").strip()[:200],
        "confidence": max(0.0, min(1.0, float(raw.get("confidence") or 0.5))),
    }


# ---------- Whisper ----------
def transcribe(audio: Path) -> list[dict]:
    """Returns [{start, end, text}]. Empty list if no Groq key or no speech."""
    if not config.GROQ_API_KEY:
        return []
    from groq import Groq

    client = Groq(api_key=config.GROQ_API_KEY)
    with open(audio, "rb") as f:
        tr = client.audio.transcriptions.create(
            file=(audio.name, f.read()),
            model=config.WHISPER_MODEL,
            response_format="verbose_json",
            prompt=WHISPER_HINT,
            temperature=0,
        )
    data = tr.model_dump() if hasattr(tr, "model_dump") else dict(tr)
    segments = data.get("segments") or []
    out = []
    for s in segments:
        s = s if isinstance(s, dict) else s.__dict__
        text = (s.get("text") or "").strip()
        if text:
            out.append({"start": round(float(s.get("start", 0)), 1), "end": round(float(s.get("end", 0)), 1), "text": text})
    if not out and data.get("text"):
        out.append({"start": 0.0, "end": 0.0, "text": data["text"].strip()})
    return out


def transcript_text(segments: list[dict]) -> str:
    if not segments:
        return "Voice transcript: (none)"
    lines = [f"[{s['start']:.1f}s] {s['text']}" for s in segments]
    return "Voice transcript:\n" + "\n".join(lines)


# ---------- Gemini ----------
@lru_cache(maxsize=1)
def _gemini():
    """One shared client. Keep a reference: a garbage-collected Client closes its HTTP connection."""
    from google import genai

    return genai.Client(api_key=config.GEMINI_API_KEY)


def _image_part(path: str):
    from google.genai import types

    return types.Part.from_bytes(data=Path(path).read_bytes(), mime_type="image/jpeg")


def detect_issues(room_name: str, inspection_type: str, frames: list[dict], segments: list[dict], duration: float) -> list[dict]:
    from google.genai import types

    contents: list = [
        f"Room: {room_name}. Inspection: {inspection_type.replace('_', '-')}.\n{transcript_text(segments)}"
    ]
    for fr in frames:
        contents.append(f"t={fr['ts']}")
        contents.append(_image_part(fr["path"]))

    resp = _gemini().models.generate_content(
        model=config.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=DETECT_PROMPT,
            response_mime_type="application/json",
            response_schema=AIRoom,
        ),
    )
    parsed = AIRoom.model_validate_json(resp.text)
    return [normalize_issue(i.model_dump(), duration) for i in parsed.issues]


def compare_room(room_name: str, move_in: list[dict], move_out: list[dict]) -> list[dict]:
    """Returns raw verdict dicts from Gemini. Caller validates them."""
    from google.genai import types

    def brief(i):
        return {k: i[k] for k in ("id", "item", "issue_type", "severity", "description")}

    contents: list = [
        f"Room: {room_name}\nMOVE-IN issues: {[brief(i) for i in move_in]}\nMOVE-OUT issues: {[brief(i) for i in move_out]}"
    ]
    for label, group in (("MOVE-IN", move_in), ("MOVE-OUT", move_out)):
        for i in group:
            if i.get("frame_path") and Path(i["frame_path"]).exists():
                contents.append(f"{label} issue {i['id']}")
                contents.append(_image_part(i["frame_path"]))

    resp = _gemini().models.generate_content(
        model=config.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=COMPARE_PROMPT,
            response_mime_type="application/json",
            response_schema=AICompare,
        ),
    )
    return [v.model_dump() for v in AICompare.model_validate_json(resp.text).verdicts]


# ---------- rule-based matcher (demo mode + safety net for AI gaps) ----------
def rule_compare(move_in: list[dict], move_out: list[dict]) -> list[dict]:
    used: set[str] = set()
    verdicts = []
    for o in move_out:
        match = next(
            (i for i in move_in if i["id"] not in used and i["item"] == o["item"] and i["issue_type"] == o["issue_type"]),
            None,
        )
        if match:
            used.add(match["id"])
            worse = SEVERITY_RANK[o["severity"]] > SEVERITY_RANK[match["severity"]]
            verdicts.append({
                "move_out_issue_id": o["id"],
                "move_in_issue_id": match["id"],
                "verdict": "worsened" if worse else "pre_existing",
                "reason": (
                    f"Recorded at move-in as {match['severity']}, now {o['severity']}."
                    if worse else "Same defect was recorded at move-in."
                ),
            })
        else:
            verdicts.append({
                "move_out_issue_id": o["id"],
                "move_in_issue_id": "",
                "verdict": "new",
                "reason": "Nothing like this was recorded in this room at move-in.",
            })
    for i in move_in:
        if i["id"] not in used:
            verdicts.append({
                "move_out_issue_id": "",
                "move_in_issue_id": i["id"],
                "verdict": "fixed",
                "reason": "Recorded at move-in, not visible at move-out.",
            })
    return verdicts


# ---------- demo mode issues ----------
DEMO_POOL = {
    "bedroom": [
        ("wall", "crack", "moderate", "Hairline crack running down from the window corner"),
        ("ceiling", "seepage", "moderate", "Damp patch on the ceiling near the fan"),
        ("furniture", "broken", "minor", "Wardrobe handle loose, right door"),
        ("floor", "scratch", "minor", "Scratch marks on the floor near the bed"),
        ("wall", "stain", "minor", "Dark stain on the wall beside the switchboard"),
    ],
    "bathroom": [
        ("tile", "crack", "moderate", "Cracked floor tile near the drain"),
        ("tap", "not_working", "minor", "Wash basin tap drips when closed"),
        ("fixture", "stain", "minor", "Hard water stains on the mirror edge"),
        ("wall", "seepage", "major", "Damp patch spreading above the geyser"),
    ],
    "kitchen": [
        ("fixture", "stain", "minor", "Oil stains on the kitchen slab"),
        ("switchboard", "broken", "moderate", "Switchboard cover cracked near the sink"),
        ("tap", "not_working", "minor", "Sink tap handle stiff and leaking"),
        ("wall", "paint_peel", "minor", "Paint peeling behind the stove"),
    ],
    "default": [
        ("wall", "stain", "minor", "Patchy stain on the main wall"),
        ("door", "scratch", "minor", "Scratches on the lower half of the door"),
        ("window", "broken", "moderate", "Window latch broken, does not lock"),
        ("floor", "crack", "moderate", "Cracked floor tile near the entrance"),
    ],
}


def _pool(room_name: str):
    key = room_name.lower()
    for k in DEMO_POOL:
        if k != "default" and k in key:
            return DEMO_POOL[k]
    return DEMO_POOL["default"]


def demo_issues(room_name: str, frames: list[dict], seed: str, carry_over: list[dict] | None = None) -> list[dict]:
    """Deterministic sample issues. For move-out, carry over move-in issues and add one new one."""
    pool = _pool(room_name)
    n = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    span = frames[-1]["ts"] if frames else 0

    def at(frac: float) -> float:
        return round(span * frac, 1)

    if carry_over:
        issues = []
        for k, i in enumerate(carry_over):
            sev = i["severity"]
            if k == 0 and sev != "major" and n % 2 == 0:
                sev = SEVERITIES[SEVERITY_RANK[sev] + 1]
            issues.append({**{f: i[f] for f in ("item", "issue_type", "description", "voice_quote")},
                           "severity": sev, "frame_ts": at(min(0.9, 0.2 + 0.3 * k)),
                           "source": "vision", "confidence": 0.82})
        taken = {(i["item"], i["issue_type"]) for i in carry_over}
        fresh = [p for p in pool if (p[0], p[1]) not in taken]
        if fresh:
            item, typ, sev, desc = fresh[n % len(fresh)]
            issues.append({"item": item, "issue_type": typ, "severity": sev, "description": desc,
                           "frame_ts": at(0.75), "source": "vision", "voice_quote": "", "confidence": 0.78})
        return issues

    count = 2 + n % 2
    start = n % len(pool)
    picks = [pool[(start + k) % len(pool)] for k in range(count)]
    return [
        {"item": item, "issue_type": typ, "severity": sev, "description": desc,
         "frame_ts": at(0.15 + 0.3 * k), "source": "vision", "voice_quote": "",
         "confidence": round(0.72 + 0.08 * (k % 3), 2)}
        for k, (item, typ, sev, desc) in enumerate(picks)
    ]

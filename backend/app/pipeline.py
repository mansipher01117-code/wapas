"""Background jobs: process one room video, and compare move-in vs move-out."""
import logging
import time
import traceback
from pathlib import Path

from . import ai, config, db, media, ratecard

log = logging.getLogger("wapas.pipeline")

VERDICTS = ("pre_existing", "worsened", "new", "fixed")


def _step(room_id: str, step: str) -> None:
    db.update("rooms", room_id, {"step": step})
    if not config.AI_LIVE:
        time.sleep(0.7)  # demo mode only: lets the UI show each step


def _nearest_frame(frames: list[dict], ts: float) -> str | None:
    if not frames:
        return None
    return min(frames, key=lambda f: abs(f["ts"] - ts))["path"]


def room_issues(room_id: str) -> list[dict]:
    return db.many("select * from issues where room_id = ? order by frame_ts", room_id)


def _norm(name: str) -> str:
    return " ".join((name or "").lower().split())


def _matching_move_in_room(inspection: dict, room_name: str) -> dict | None:
    return db.one(
        """select r.* from rooms r join inspections i on i.id = r.inspection_id
           where i.property_id = ? and i.type = 'move_in' and lower(trim(r.name)) = ? and r.status = 'ready'
           order by i.created_at desc limit 1""",
        inspection["property_id"], _norm(room_name),
    )


def process_room(room_id: str) -> None:
    room = db.one("select * from rooms where id = ?", room_id)
    if not room:
        return
    insp = db.one("select * from inspections where id = ?", room["inspection_id"])
    video = Path(room["video_path"])
    work = video.parent
    try:
        db.update("rooms", room_id, {"status": "processing", "error": None,
                                     "ai_mode": "live" if config.AI_LIVE else "demo"})

        _step(room_id, "frames")
        duration = media.probe_duration(video)
        frames = media.extract_frames(video, work / "frames", duration)
        db.update("rooms", room_id, {"duration": duration, "frames": db.dumps(frames)})

        _step(room_id, "listening")
        segments: list[dict] = []
        audio = media.extract_audio(video, work / "audio.wav")
        if audio:
            try:
                segments = ai.transcribe(audio)
            except Exception as e:  # speech is a bonus, never block the report on it
                log.warning("Whisper failed for %s: %s", room_id, e)
        db.update("rooms", room_id, {"transcript": db.dumps(segments)})

        _step(room_id, "inspecting")
        if config.AI_LIVE:
            found = ai.detect_issues(room["name"], insp["type"], frames, segments, duration)
        else:
            carry = None
            if insp["type"] == "move_out":
                prev = _matching_move_in_room(insp, room["name"])
                carry = room_issues(prev["id"]) if prev else None
            found = ai.demo_issues(room["name"], frames, room["video_sha256"] or room_id, carry)

        db.run("delete from issues where room_id = ?", room_id)
        for f in found:
            db.insert("issues", {
                "id": db.new_id(), "room_id": room_id, **f,
                "frame_path": _nearest_frame(frames, f["frame_ts"]),
                "user_edited": 0, "created_at": db.now(),
            })

        db.update("rooms", room_id, {"status": "ready", "step": "done"})
    except Exception as e:
        log.error("Room %s failed: %s\n%s", room_id, e, traceback.format_exc())
        db.update("rooms", room_id, {"status": "failed", "error": _friendly(e)})


def _friendly(e: Exception) -> str:
    msg = str(e)
    if "API key" in msg or "PERMISSION_DENIED" in msg or "401" in msg:
        return "AI key rejected. Check GEMINI_API_KEY in backend/.env."
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        return "AI rate limit hit. Wait a minute and tap retry."
    return msg[:240] or e.__class__.__name__


# ---------- compare ----------
def _validate(raw: list[dict], move_in: list[dict], move_out: list[dict]) -> list[dict]:
    in_ids = {i["id"]: i for i in move_in}
    out_ids = {o["id"]: o for o in move_out}
    used_in: set[str] = set()
    used_out: set[str] = set()
    final: list[dict] = []

    for v in raw:
        verdict = (v.get("verdict") or "").strip().lower()
        oid, iid = v.get("move_out_issue_id") or "", v.get("move_in_issue_id") or ""
        reason = (v.get("reason") or "").strip()[:220]
        if verdict in ("pre_existing", "worsened"):
            if oid in out_ids and iid in in_ids and oid not in used_out and iid not in used_in:
                used_out.add(oid)
                used_in.add(iid)
                final.append({"move_out_issue_id": oid, "move_in_issue_id": iid, "verdict": verdict, "reason": reason})
        elif verdict == "new" and oid in out_ids and oid not in used_out:
            used_out.add(oid)
            final.append({"move_out_issue_id": oid, "move_in_issue_id": "", "verdict": "new", "reason": reason})

    # Anything the AI skipped goes through the rule matcher; leftover move-in issues become "fixed".
    rest_in = [i for i in move_in if i["id"] not in used_in]
    rest_out = [o for o in move_out if o["id"] not in used_out]
    final.extend(ai.rule_compare(rest_in, rest_out))
    return final


def run_comparison(comparison_id: str) -> None:
    cmp = db.one("select * from comparisons where id = ?", comparison_id)
    if not cmp:
        return
    try:
        prop = db.one("select is_sample from properties where id = ?", cmp["property_id"])
        # Sample data never goes to the AI: the rule matcher reaches the same verdicts for free.
        is_sample = bool(prop and prop["is_sample"])
        live = config.AI_LIVE and not is_sample
        db.update("comparisons", comparison_id, {"status": "processing", "error": None,
                                                 "ai_mode": "live" if live else "demo"})
        in_rooms = {_norm(r["name"]): r for r in db.many(
            "select * from rooms where inspection_id = ? and status = 'ready'", cmp["move_in_id"])}
        out_rooms = db.many(
            "select * from rooms where inspection_id = ? and status = 'ready' order by created_at", cmp["move_out_id"])

        db.run("delete from comparison_items where comparison_id = ?", comparison_id)
        total_min = total_max = 0

        for out_room in out_rooms:
            in_room = in_rooms.get(_norm(out_room["name"]))
            move_in = room_issues(in_room["id"]) if in_room else []
            move_out = room_issues(out_room["id"])
            if not move_in and not move_out:
                continue

            raw: list[dict] = []
            if live:
                try:
                    raw = ai.compare_room(out_room["name"], move_in, move_out)
                except Exception as e:
                    log.warning("AI compare failed for %s, using rule matcher: %s", out_room["name"], e)
            elif not is_sample:
                time.sleep(0.6)  # demo mode only: lets the UI show the checklist
            verdicts = _validate(raw, move_in, move_out)

            out_by_id = {o["id"]: o for o in move_out}
            for v in verdicts:
                o = out_by_id.get(v["move_out_issue_id"])
                lo, hi = (ratecard.estimate(o["item"], o["issue_type"], o["severity"], v["verdict"]) if o else (0, 0))
                total_min += lo
                total_max += hi
                db.insert("comparison_items", {
                    "id": db.new_id(), "comparison_id": comparison_id, "room_name": (in_room or out_room)["name"],
                    "verdict": v["verdict"], "move_in_issue_id": v["move_in_issue_id"] or None,
                    "move_out_issue_id": v["move_out_issue_id"] or None, "reason": v["reason"],
                    "cost_min": lo, "cost_max": hi,
                })

        db.update("comparisons", comparison_id, {"status": "ready", "fair_min": total_min, "fair_max": total_max})
    except Exception as e:
        log.error("Comparison %s failed: %s\n%s", comparison_id, e, traceback.format_exc())
        db.update("comparisons", comparison_id, {"status": "failed", "error": _friendly(e)})

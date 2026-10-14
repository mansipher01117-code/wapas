"""One deterministic sample case, so a fresh deploy always has something to show.

Nothing here needs a video file or an AI call: the rooms carry no video, the issues come
from the same demo pool as demo mode, and the verdicts and costs come from the real
comparison pipeline.
"""
from . import ai, db, pipeline

PROPERTY = {
    "tenant_name": "Sample tenant",
    "address": "Sample flat, 2BHK",
    "city": "Ghaziabad",
    "rent": 18000,
    "deposit": 60000,
    "landlord_name": "Sample landlord",
    "landlord_phone": "",
    "is_sample": 1,
}

ROOMS = ("Bedroom", "Bathroom", "Kitchen")

# A voice note per kind of problem, so a quote always matches the issue it sits on.
VOICE = {
    "crack": "yahan crack aa gaya hai",
    "seepage": "yahan seelan aa gayi hai",
    "stain": "yeh daag lag gaya hai",
    "broken": "yeh toot gaya hai",
    "missing": "yeh nikal gaya hai",
    "scratch": "yahan scratch pad gaya hai",
    "dirty": "yahan safai nahi hui",
    "not_working": "yeh kaam nahi kar raha",
    "paint_peel": "paint ukhad raha hai",
}

SOURCES = ("vision", "voice", "both", "tenant")


def _room(inspection_id: str, name: str) -> dict:
    """A room with no video: video_path, sha256 and frames stay empty on purpose."""
    return db.insert("rooms", {
        "id": db.new_id(), "inspection_id": inspection_id, "name": name,
        "video_path": None, "video_sha256": None, "video_bytes": 0, "duration": 0,
        "status": "ready", "step": "done", "error": None, "ai_mode": "demo",
        "transcript": None, "frames": None, "capture_source": "file",
        "created_at": db.now(),
    })


def _issues(room_id: str, found: list[dict], room_index: int, mix_sources: bool) -> list[dict]:
    """Writes the issues and returns the transcript lines for the quotes it used."""
    segments = []
    for k, f in enumerate(found):
        source = SOURCES[(room_index + k) % len(SOURCES)] if mix_sources else "vision"
        quote = VOICE.get(f["issue_type"], "yeh theek karwana padega") if source in ("voice", "both") else ""
        if quote:
            start = float(4 * len(segments))
            segments.append({"start": start, "end": start + 3.0, "text": quote})
        db.insert("issues", {
            "id": db.new_id(), "room_id": room_id, **f,
            "source": source, "voice_quote": quote, "frame_path": None,
            "user_edited": 1 if source == "tenant" else 0,
            "created_at": db.now(),
        })
    return segments


def _ids(pid: str) -> dict:
    mi = db.one("select id from inspections where property_id = ? and type = 'move_in'", pid)
    mo = db.one("select id from inspections where property_id = ? and type = 'move_out'", pid)
    cmp = db.one("select id from comparisons where property_id = ? order by created_at desc limit 1", pid)
    return {"property_id": pid, "move_in_id": mi["id"] if mi else None,
            "move_out_id": mo["id"] if mo else None, "comparison_id": cmp["id"] if cmp else None}


def load() -> dict:
    """Build the sample case once. Called again, it returns the ids of the one that exists."""
    found = db.one("select id from properties where is_sample = 1 order by created_at limit 1")
    if found:
        return {**_ids(found["id"]), "created": False}

    pid = db.new_id()
    db.insert("properties", {"id": pid, **PROPERTY, "created_at": db.now()})
    try:
        insp = {}
        for kind in ("move_in", "move_out"):
            insp[kind] = db.insert("inspections", {"id": db.new_id(), "property_id": pid, "type": kind,
                                                   "locked_at": None, "lock_type": None, "created_at": db.now()})
            out = kind == "move_out"
            for k, name in enumerate(ROOMS):
                room = _room(insp[kind]["id"], name)
                carry = None
                if out:
                    before = db.one("select id from rooms where inspection_id = ? and name = ?",
                                    insp["move_in"]["id"], name)
                    carry = pipeline.room_issues(before["id"])
                found = ai.demo_issues(name, [], f"{pid}:{name}", carry)
                segments = _issues(room["id"], found, k, out)
                if segments:
                    db.update("rooms", room["id"], {"transcript": db.dumps(segments)})

        # A signed move-in is what makes a verdict mean anything, so the sample has one.
        signed = db.now()
        db.insert("signoffs", {
            "id": db.new_id(), "inspection_id": insp["move_in"]["id"], "token": db.new_id(),
            "signer_name": PROPERTY["landlord_name"], "decision": "agree",
            "note": "Sample sign-off.", "ip": None, "user_agent": None,
            "signed_at": signed, "created_at": signed,
        })
        db.update("inspections", insp["move_in"]["id"], {"locked_at": signed, "lock_type": "mutual"})

        cid = db.new_id()
        db.insert("comparisons", {
            "id": cid, "property_id": pid, "move_in_id": insp["move_in"]["id"],
            "move_out_id": insp["move_out"]["id"], "status": "queued", "error": None,
            "ai_mode": None, "fair_min": 0, "fair_max": 0, "created_at": db.now(),
        })
        pipeline.run_comparison(cid)  # real verdicts and rate-card costs, no AI call
    except Exception:
        db.run("delete from properties where id = ?", pid)  # cascades to everything above
        raise

    return {**_ids(pid), "created": True}

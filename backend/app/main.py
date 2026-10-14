"""Wapas API. Run: uvicorn app.main:app --reload --port 8000"""
import hashlib
import logging
import secrets
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, db, pipeline, ratecard, sample
from .prompts import ISSUE_TYPES, ITEMS, SEVERITIES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# How the video reached us: shot in the app's camera, or picked from the gallery.
CAPTURE_SOURCES = ("camera", "file")

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Wapas API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=config.STORAGE_DIR), name="media")


# ---------- helpers ----------
def media_url(path: str | None) -> str | None:
    if not path:
        return None
    try:
        rel = Path(path).resolve().relative_to(config.STORAGE_DIR)
    except ValueError:
        return None
    return f"{config.PUBLIC_BASE_URL}/media/{rel.as_posix()}"


def must(row: dict | None, what: str) -> dict:
    if not row:
        raise HTTPException(404, f"{what} not found")
    return row


def issue_out(i: dict) -> dict:
    return {**{k: i[k] for k in ("id", "room_id", "item", "issue_type", "severity", "description",
                                 "frame_ts", "source", "voice_quote", "confidence")},
            "user_edited": bool(i["user_edited"]), "frame_url": media_url(i["frame_path"])}


def room_out(r: dict, with_issues: bool = True) -> dict:
    frames = db.loads(r["frames"], [])
    out = {
        "id": r["id"], "name": r["name"], "status": r["status"], "step": r["step"], "error": r["error"],
        "ai_mode": r["ai_mode"], "duration": r["duration"], "sha256": r["video_sha256"],
        "video_bytes": r["video_bytes"], "created_at": r["created_at"],
        "capture_source": r["capture_source"] or "file",
        "video_url": media_url(r["video_path"]),
        "poster_url": media_url(frames[0]["path"]) if frames else None,
        "frames": [{"ts": f["ts"], "url": media_url(f["path"])} for f in frames],
        "transcript": db.loads(r["transcript"], []),
    }
    if with_issues:
        out["issues"] = [issue_out(i) for i in pipeline.room_issues(r["id"])]
    return out


def inspection_status(rooms: list[dict]) -> str:
    if not rooms:
        return "empty"
    states = {r["status"] for r in rooms}
    if states & {"queued", "processing"}:
        return "processing"
    if "failed" in states:
        return "attention"
    return "ready"


def latest_signoff(inspection_id: str) -> dict | None:
    s = db.one("select * from signoffs where inspection_id = ? order by created_at desc limit 1", inspection_id)
    if not s:
        return None
    return {k: s[k] for k in ("token", "signer_name", "decision", "note", "signed_at", "created_at")}


def inspection_out(insp: dict, full: bool = True) -> dict:
    rooms = db.many("select * from rooms where inspection_id = ? order by created_at", insp["id"])
    issue_count = db.one(
        "select count(*) n from issues where room_id in (select id from rooms where inspection_id = ?)", insp["id"]
    )["n"]
    out = {
        "id": insp["id"], "property_id": insp["property_id"], "type": insp["type"],
        "locked_at": insp["locked_at"], "lock_type": insp["lock_type"], "created_at": insp["created_at"],
        "status": inspection_status(rooms), "room_count": len(rooms), "issue_count": issue_count,
        "signoff": latest_signoff(insp["id"]),
    }
    if full:
        out["rooms"] = [room_out(r) for r in rooms]
    else:
        out["room_names"] = [r["name"] for r in rooms]
    return out


def property_out(p: dict, full: bool = False) -> dict:
    insps = db.many("select * from inspections where property_id = ? order by created_at", p["id"])
    cmp = db.one("select * from comparisons where property_id = ? order by created_at desc limit 1", p["id"])
    out = {**p, "is_sample": bool(p["is_sample"]), "move_in": None, "move_out": None,
           "comparison": {k: cmp[k] for k in ("id", "status", "fair_min", "fair_max", "created_at")} if cmp else None}
    for i in insps:
        out[i["type"]] = inspection_out(i, full=False)
    return out


def assert_unlocked(insp: dict) -> None:
    if insp["locked_at"]:
        raise HTTPException(409, "This report is locked after sign-off and can't be changed.")


# ---------- health ----------
@app.get("/api/health")
def health():
    return {"ok": True, "ai_live": config.AI_LIVE, "whisper": bool(config.GROQ_API_KEY),
            "model": config.GEMINI_MODEL if config.AI_LIVE else "demo"}


# ---------- properties ----------
class PropertyIn(BaseModel):
    tenant_name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=3, max_length=240)
    city: str = Field(min_length=2, max_length=60)
    rent: int = Field(ge=0, default=0)
    deposit: int = Field(ge=0, default=0)
    landlord_name: str = Field(default="", max_length=80)
    landlord_phone: str = Field(default="", max_length=20)


@app.post("/api/properties")
def create_property(body: PropertyIn):
    p = db.insert("properties", {"id": db.new_id(), **body.model_dump(), "created_at": db.now()})
    return property_out(p)


@app.get("/api/properties")
def list_properties():
    return [property_out(p) for p in db.many("select * from properties order by created_at desc")]


@app.get("/api/properties/{pid}")
def get_property(pid: str):
    return property_out(must(db.one("select * from properties where id = ?", pid), "Property"))


@app.delete("/api/properties/{pid}")
def delete_property(pid: str):
    must(db.one("select * from properties where id = ?", pid), "Property")
    for insp in db.many("select id from inspections where property_id = ?", pid):
        shutil.rmtree(config.STORAGE_DIR / insp["id"], ignore_errors=True)
    db.run("delete from properties where id = ?", pid)
    return {"ok": True}


# ---------- inspections ----------
class InspectionIn(BaseModel):
    type: Literal["move_in", "move_out"]


@app.post("/api/properties/{pid}/inspections")
def start_inspection(pid: str, body: InspectionIn):
    must(db.one("select * from properties where id = ?", pid), "Property")
    existing = db.one("select * from inspections where property_id = ? and type = ?", pid, body.type)
    if existing:
        return inspection_out(existing)
    if body.type == "move_out":
        mi = db.one("select * from inspections where property_id = ? and type = 'move_in'", pid)
        if not mi or inspection_out(mi, full=False)["status"] != "ready":
            raise HTTPException(400, "Record the move-in rooms first. Move-out is compared against them.")
    insp = db.insert("inspections", {"id": db.new_id(), "property_id": pid, "type": body.type,
                                     "locked_at": None, "lock_type": None, "created_at": db.now()})
    return inspection_out(insp)


@app.get("/api/inspections/{iid}")
def get_inspection(iid: str):
    insp = must(db.one("select * from inspections where id = ?", iid), "Inspection")
    p = db.one("select * from properties where id = ?", insp["property_id"])
    return {**inspection_out(insp), "property": p}


@app.post("/api/inspections/{iid}/rooms")
async def upload_room(iid: str, background: BackgroundTasks, name: str = Form(...),
                      capture_source: str = Form("file"), file: UploadFile = File(...)):
    insp = must(db.one("select * from inspections where id = ?", iid), "Inspection")
    assert_unlocked(insp)
    name = " ".join(name.split())[:40] or "Room"
    if capture_source not in CAPTURE_SOURCES:
        raise HTTPException(422, f"capture_source must be one of: {', '.join(CAPTURE_SOURCES)}")

    # Re-recording a room replaces the old take.
    old = db.one("select * from rooms where inspection_id = ? and lower(name) = lower(?)", iid, name)
    if old:
        shutil.rmtree(config.STORAGE_DIR / iid / old["id"], ignore_errors=True)
        db.run("delete from rooms where id = ?", old["id"])

    room_id = db.new_id()
    folder = config.STORAGE_DIR / iid / room_id
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "video.mp4").suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".webm", ".3gp", ".mkv", ".m4v", ".avi"}:
        ext = ".mp4"
    video = folder / f"video{ext}"

    h = hashlib.sha256()
    size = 0
    with open(video, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            h.update(chunk)
            size += len(chunk)
            out.write(chunk)
    if size == 0:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(400, "That file is empty. Record the room again.")

    db.insert("rooms", {
        "id": room_id, "inspection_id": iid, "name": name, "video_path": str(video),
        "video_sha256": h.hexdigest(), "video_bytes": size, "duration": 0, "status": "queued",
        "step": "hashed", "error": None, "ai_mode": None, "transcript": None, "frames": None,
        "capture_source": capture_source, "created_at": db.now(),
    })
    background.add_task(pipeline.process_room, room_id)
    return room_out(db.one("select * from rooms where id = ?", room_id))


@app.delete("/api/rooms/{rid}")
def delete_room(rid: str):
    room = must(db.one("select * from rooms where id = ?", rid), "Room")
    assert_unlocked(db.one("select * from inspections where id = ?", room["inspection_id"]))
    if room["video_path"]:
        shutil.rmtree(Path(room["video_path"]).parent, ignore_errors=True)
    db.run("delete from rooms where id = ?", rid)
    return {"ok": True}


@app.post("/api/rooms/{rid}/retry")
def retry_room(rid: str, background: BackgroundTasks):
    room = must(db.one("select * from rooms where id = ?", rid), "Room")
    assert_unlocked(db.one("select * from inspections where id = ?", room["inspection_id"]))
    db.update("rooms", rid, {"status": "queued", "error": None, "step": "hashed"})
    background.add_task(pipeline.process_room, rid)
    return {"ok": True}


# ---------- issues ----------
class IssueIn(BaseModel):
    item: str = "other"
    issue_type: str = "other"
    severity: str = "minor"
    description: str = Field(min_length=2, max_length=160)
    frame_ts: float = 0


class IssuePatch(BaseModel):
    item: str | None = None
    issue_type: str | None = None
    severity: str | None = None
    description: str | None = Field(default=None, max_length=160)


def _clean(field: str, value: str) -> str:
    allowed = {"item": ITEMS, "issue_type": ISSUE_TYPES, "severity": SEVERITIES}[field]
    if value not in allowed:
        raise HTTPException(422, f"{field} must be one of: {', '.join(allowed)}")
    return value


def _room_inspection(room_id: str) -> tuple[dict, dict]:
    room = must(db.one("select * from rooms where id = ?", room_id), "Room")
    return room, db.one("select * from inspections where id = ?", room["inspection_id"])


@app.post("/api/rooms/{rid}/issues")
def add_issue(rid: str, body: IssueIn):
    room, insp = _room_inspection(rid)
    assert_unlocked(insp)
    frames = db.loads(room["frames"], [])
    frame = min(frames, key=lambda f: abs(f["ts"] - body.frame_ts))["path"] if frames else None
    i = db.insert("issues", {
        "id": db.new_id(), "room_id": rid, "item": _clean("item", body.item),
        "issue_type": _clean("issue_type", body.issue_type), "severity": _clean("severity", body.severity),
        "description": body.description.strip(), "frame_ts": body.frame_ts, "frame_path": frame,
        "source": "tenant", "voice_quote": "", "confidence": 1.0, "user_edited": 1, "created_at": db.now(),
    })
    return issue_out(i)


@app.patch("/api/issues/{issue_id}")
def edit_issue(issue_id: str, body: IssuePatch):
    i = must(db.one("select * from issues where id = ?", issue_id), "Issue")
    assert_unlocked(_room_inspection(i["room_id"])[1])
    changes = {k: (_clean(k, v) if k != "description" else v.strip())
               for k, v in body.model_dump(exclude_none=True).items()}
    if changes:
        db.update("issues", issue_id, {**changes, "user_edited": 1})
    return issue_out(db.one("select * from issues where id = ?", issue_id))


@app.delete("/api/issues/{issue_id}")
def delete_issue(issue_id: str):
    i = must(db.one("select * from issues where id = ?", issue_id), "Issue")
    assert_unlocked(_room_inspection(i["room_id"])[1])
    db.run("delete from issues where id = ?", issue_id)
    return {"ok": True}


# ---------- landlord sign-off ----------
@app.post("/api/inspections/{iid}/share")
def share_inspection(iid: str):
    insp = must(db.one("select * from inspections where id = ?", iid), "Inspection")
    assert_unlocked(insp)
    if inspection_out(insp, full=False)["status"] != "ready":
        raise HTTPException(400, "Wait until every room's report is ready before sending it.")
    pending = db.one("select * from signoffs where inspection_id = ? and decision is null "
                     "order by created_at desc limit 1", iid)
    if pending:
        return {"token": pending["token"]}
    token = secrets.token_urlsafe(12)
    db.insert("signoffs", {"id": db.new_id(), "inspection_id": iid, "token": token, "signer_name": None,
                           "decision": None, "note": None, "ip": None, "user_agent": None,
                           "signed_at": None, "created_at": db.now()})
    return {"token": token}


@app.post("/api/inspections/{iid}/lock")
def lock_tenant_only(iid: str):
    """Landlord didn't respond: tenant locks the record on their own (timestamp still holds)."""
    insp = must(db.one("select * from inspections where id = ?", iid), "Inspection")
    assert_unlocked(insp)
    db.update("inspections", iid, {"locked_at": db.now(), "lock_type": "tenant_only"})
    return inspection_out(db.one("select * from inspections where id = ?", iid))


@app.get("/api/sign/{token}")
def sign_view(token: str):
    s = must(db.one("select * from signoffs where token = ?", token), "Sign-off link")
    insp = db.one("select * from inspections where id = ?", s["inspection_id"])
    p = db.one("select * from properties where id = ?", insp["property_id"])
    return {"signoff": {k: s[k] for k in ("signer_name", "decision", "note", "signed_at")},
            "inspection": inspection_out(insp),
            "property": {k: p[k] for k in ("tenant_name", "address", "city", "rent", "deposit", "landlord_name")}}


class SignIn(BaseModel):
    signer_name: str = Field(min_length=2, max_length=80)
    decision: Literal["agree", "dispute"]
    note: str = Field(default="", max_length=500)


@app.post("/api/sign/{token}")
def sign_submit(token: str, body: SignIn, request: Request):
    s = must(db.one("select * from signoffs where token = ?", token), "Sign-off link")
    if s["decision"]:
        raise HTTPException(409, "This report has already been answered.")
    if body.decision == "dispute" and not body.note.strip():
        raise HTTPException(422, "Add a note saying what you disagree with.")
    db.update("signoffs", s["id"], {
        "signer_name": body.signer_name.strip(), "decision": body.decision, "note": body.note.strip() or None,
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", "")[:300], "signed_at": db.now(),
    })
    if body.decision == "agree":
        db.update("inspections", s["inspection_id"], {"locked_at": db.now(), "lock_type": "mutual"})
    return sign_view(token)


# ---------- compare ----------
@app.post("/api/properties/{pid}/compare")
def start_compare(pid: str, background: BackgroundTasks):
    must(db.one("select * from properties where id = ?", pid), "Property")
    mi = db.one("select * from inspections where property_id = ? and type = 'move_in'", pid)
    mo = db.one("select * from inspections where property_id = ? and type = 'move_out'", pid)
    if not mi or not mo:
        raise HTTPException(400, "Record both move-in and move-out before comparing.")
    if inspection_out(mo, full=False)["status"] != "ready":
        raise HTTPException(400, "Wait until every move-out room is processed.")
    cid = db.new_id()
    db.insert("comparisons", {"id": cid, "property_id": pid, "move_in_id": mi["id"], "move_out_id": mo["id"],
                              "status": "queued", "error": None, "ai_mode": None, "fair_min": 0, "fair_max": 0,
                              "created_at": db.now()})
    background.add_task(pipeline.run_comparison, cid)
    return {"id": cid, "status": "queued"}


def _ref_frame(in_room: dict | None, out_issue: dict | None, out_room: dict | None) -> str | None:
    """For a 'new' issue: the move-in frame at the same point in the walkthrough, so both sides show the spot."""
    if not in_room or not out_issue or not out_room:
        return None
    frames = db.loads(in_room["frames"], [])
    if not frames:
        return None
    ratio = (out_issue["frame_ts"] / out_room["duration"]) if out_room["duration"] else 0
    target = ratio * (in_room["duration"] or 0)
    return media_url(min(frames, key=lambda f: abs(f["ts"] - target))["path"])


@app.get("/api/comparisons/{cid}")
def get_comparison(cid: str):
    cmp = must(db.one("select * from comparisons where id = ?", cid), "Comparison")
    p = db.one("select * from properties where id = ?", cmp["property_id"])
    mi = db.one("select * from inspections where id = ?", cmp["move_in_id"])
    in_rooms = {pipeline._norm(r["name"]): r for r in db.many("select * from rooms where inspection_id = ?", mi["id"])}
    out_rooms = {pipeline._norm(r["name"]): r for r in db.many("select * from rooms where inspection_id = ?", cmp["move_out_id"])}

    items = []
    order = {"new": 0, "worsened": 1, "pre_existing": 2, "fixed": 3}
    for it in db.many("select * from comparison_items where comparison_id = ?", cid):
        mi_issue = db.one("select * from issues where id = ?", it["move_in_issue_id"]) if it["move_in_issue_id"] else None
        mo_issue = db.one("select * from issues where id = ?", it["move_out_issue_id"]) if it["move_out_issue_id"] else None
        key = pipeline._norm(it["room_name"])
        items.append({
            **it,
            "move_in": issue_out(mi_issue) if mi_issue else None,
            "move_out": issue_out(mo_issue) if mo_issue else None,
            "move_in_ref_frame": _ref_frame(in_rooms.get(key), mo_issue, out_rooms.get(key)) if not mi_issue else None,
        })
    items.sort(key=lambda x: (order.get(x["verdict"], 9), x["room_name"]))

    return {
        **cmp, "items": items, "rate_card_note": ratecard.source_note(),
        "property": property_out(p),
        "move_in": {"id": mi["id"], "locked_at": mi["locked_at"], "lock_type": mi["lock_type"],
                    "signoff": latest_signoff(mi["id"]), "created_at": mi["created_at"]},
        "counts": {v: sum(1 for i in items if i["verdict"] == v) for v in pipeline.VERDICTS},
    }


# ---------- sample data ----------
@app.post("/api/demo/sample")
def load_sample():
    """Fills an empty deployment with one clearly-marked sample case. Safe to call twice."""
    return sample.load()


# ---------- verify ----------
def _verify(sha: str) -> dict:
    r = db.one("select * from rooms where video_sha256 = ? order by created_at limit 1", sha.lower())
    if not r:
        return {"match": False, "sha256": sha}
    insp = db.one("select * from inspections where id = ?", r["inspection_id"])
    p = db.one("select * from properties where id = ?", insp["property_id"])
    so = latest_signoff(insp["id"])
    return {
        "match": True, "sha256": sha, "room": r["name"], "inspection_type": insp["type"],
        "uploaded_at": r["created_at"], "city": p["city"], "address": p["address"],
        "locked_at": insp["locked_at"], "lock_type": insp["lock_type"],
        "signoff": {k: v for k, v in so.items() if k != "token"} if so else None,
    }


@app.get("/api/verify/{sha}")
def verify_hash(sha: str):
    return _verify(sha)


@app.post("/api/verify")
async def verify_file(file: UploadFile = File(...)):
    h = hashlib.sha256()
    while chunk := await file.read(1024 * 1024):
        h.update(chunk)
    return _verify(h.hexdigest())

"""App settings, loaded from backend/.env"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Everything this app writes lives under DATA_DIR: the database, the uploaded room videos and
# the frames extracted from them. Mount a disk there and the data survives a restart.
# Unset means "where it has always been", so local development is unchanged.
DATA_DIR_SET = bool(os.getenv("DATA_DIR", "").strip())
DATA_DIR = Path(os.getenv("DATA_DIR") or BASE_DIR).resolve()
STORAGE_DIR = Path(os.getenv("STORAGE_DIR") or DATA_DIR / "storage").resolve()
DB_PATH = Path(os.getenv("DB_PATH") or DATA_DIR / "wapas.db").resolve()

# Set this to turn on GET /api/admin/backup. Unset keeps the endpoint hidden.
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").strip()


def ensure_dirs() -> None:
    """Create the data folders if they are missing. Safe to call again."""
    for d in (DATA_DIR, STORAGE_DIR, DB_PATH.parent):
        os.makedirs(d, exist_ok=True)


def writable(path: Path) -> bool:
    probe = path / ".wapas-write-check"
    try:
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def stale_local_data() -> list[str]:
    """Old files under backend/ that DATA_DIR now bypasses. Nothing is ever moved for you."""
    if not DATA_DIR_SET:
        return []
    return [old.name for old, used in ((BASE_DIR / "wapas.db", DB_PATH), (BASE_DIR / "storage", STORAGE_DIR))
            if old.exists() and old.resolve() != used]


ensure_dirs()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-large-v3").strip()

# Demo mode = no AI keys, pipeline returns sample issues so the UI can be built and tested.
FORCE_DEMO = os.getenv("FORCE_DEMO", "0").strip() == "1"
AI_LIVE = bool(GEMINI_API_KEY) and not FORCE_DEMO

# Public URL of this API when deployed (e.g. https://wapas-api.up.railway.app).
# Empty locally: media links stay relative and go through the Next.js proxy.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")

# Frame sampling: 1 frame every 2 s, never more than MAX_FRAMES per room video.
FRAME_INTERVAL_SEC = float(os.getenv("FRAME_INTERVAL_SEC", "2"))
MAX_FRAMES = int(os.getenv("MAX_FRAMES", "20"))
FRAME_WIDTH = int(os.getenv("FRAME_WIDTH", "1024"))

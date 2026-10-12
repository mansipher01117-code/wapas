"""App settings, loaded from backend/.env"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", BASE_DIR / "storage")).resolve()
DB_PATH = Path(os.getenv("DB_PATH", BASE_DIR / "wapas.db")).resolve()
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

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

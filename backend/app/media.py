"""Video helpers: hashing, duration, frame + audio extraction (ffmpeg ships with imageio-ffmpeg)."""
import hashlib
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg

from .config import FRAME_INTERVAL_SEC, FRAME_WIDTH, MAX_FRAMES

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def _run(args: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(
        [FFMPEG, "-hide_banner", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def probe_duration(video: Path) -> float:
    """Read 'Duration: HH:MM:SS.xx' from ffmpeg's stderr."""
    out = _run(["-i", str(video)], timeout=60).stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", out)
    if not m:
        return 0.0
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


def extract_frames(video: Path, out_dir: Path, duration: float) -> list[dict]:
    """Sample frames evenly. Returns [{ts, path}] where ts is seconds into the video."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("f_*.jpg"):
        old.unlink()

    fps = 1.0 / FRAME_INTERVAL_SEC
    if duration > 0 and duration * fps > MAX_FRAMES:
        fps = MAX_FRAMES / duration

    res = _run(
        [
            "-y", "-i", str(video),
            "-vf", f"fps={fps:.5f},scale={FRAME_WIDTH}:-2",
            "-q:v", "3",
            str(out_dir / "f_%04d.jpg"),
        ]
    )
    files = sorted(out_dir.glob("f_*.jpg"))
    if res.returncode != 0 or not files:
        raise RuntimeError("Could not read frames from this video. Try recording it again in MP4.")

    return [{"ts": round(i / fps, 1), "path": str(p)} for i, p in enumerate(files)]


def extract_audio(video: Path, out_path: Path) -> Path | None:
    """16 kHz mono WAV for Whisper. Returns None when the video has no audio track."""
    res = _run(["-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(out_path)])
    if res.returncode != 0 or not out_path.exists() or out_path.stat().st_size < 2000:
        return None
    return out_path

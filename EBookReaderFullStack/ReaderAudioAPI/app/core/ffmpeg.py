import os
import shutil

def get_ffmpeg_path() -> str:
    env_path = os.getenv("FFMPEG_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    raise RuntimeError(
        "FFmpeg not found. Install FFmpeg or set FFMPEG_PATH env variable."
    )

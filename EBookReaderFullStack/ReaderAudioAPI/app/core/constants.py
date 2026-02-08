from pydantic import BaseModel
from typing import List, Dict
import re
import os
import shutil
import platform

# ======================================================
# CONFIG
# ======================================================

SPEAKERS_DIR = os.path.join("app", "speakers")

MIN_SPEED = 0.9
MAX_SPEED = 1.4
MIN_STEPS = 3
MAX_STEPS = 14


# ======================================================
# MODELS
# ======================================================

class VoiceStyle(BaseModel):
    """
    Sistemde mevcut bir sesi temsil eder.
    Kaynak: app/speakers/{voice}_{emotion}.wav
    """
    id: str
    name: str
    emotions: List[str]




def load_voice_styles() -> List[VoiceStyle]:
    """
    app/speakers klasörünü tarar ve mevcut voice + emotion listesini çıkarır.

    Beklenen dosya formatı:
        {voice_id}_{emotion}.wav

    Örnek:
        damien_black_neutral.wav
        damien_black_happy.wav
        canan_sad.wav
    """

    if not os.path.exists(SPEAKERS_DIR):
        return []

    voices: Dict[str, set] = {}

    for filename in os.listdir(SPEAKERS_DIR):
        if not filename.lower().endswith(".wav"):
            continue

        match = re.match(r"(.+?)_(.+?)\.wav$", filename)
        if not match:
            continue

        voice_id, emotion = match.groups()

        voice_id = voice_id.lower()
        emotion = emotion.lower()

        if voice_id not in voices:
            voices[voice_id] = set()

        voices[voice_id].add(emotion)

    result: List[VoiceStyle] = []

    for voice_id, emotions in voices.items():
        result.append(
            VoiceStyle(
                id=voice_id,
                name=voice_id.replace("_", " ").title(),
                emotions=sorted(emotions),
            )
        )

    result.sort(key=lambda v: v.name)

    return result


def resolve_ffmpeg_path() -> str:
    """
    FFmpeg binary'sini platforma göre otomatik bulur.
    Öncelik sırası:
    1) ENV: FFMPEG_PATH
    2) PATH içinden (which / where)
    3) Windows bilinen kurulum yolları
    """

    env_path = os.getenv("FFMPEG_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    if platform.system() == "Windows":
        candidates = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
            os.path.expandvars(
                r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\**\bin\ffmpeg.exe"
            ),
        ]

        for path in candidates:
            if "*" in path:
                import glob
                matches = glob.glob(path, recursive=True)
                if matches:
                    return matches[0]
            elif os.path.exists(path):
                return path

    raise RuntimeError(
        "FFmpeg bulunamadı. "
        "Lütfen FFmpeg kur veya FFMPEG_PATH env değişkenini ayarla."
    )

import os
import re
import sys
import logging
import subprocess
from datetime import timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.v2.router import api_router
from app.core.database import Base, engine, SessionLocal
from app.models.book import Book, Chunk
from app.services.tts import tts_service

from app.core.ffmpeg import get_ffmpeg_path


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ReaderAudioAPI v2", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FFMPEG_PATH = get_ffmpeg_path()


def generate_srt(chunks):
    srt_content = ""
    current_time = timedelta(seconds=0)

    for i, chunk in enumerate(chunks):
        duration = chunk.duration if (chunk.duration and chunk.duration > 0) else (len(chunk.text.split()) * 0.5)
        start_time = current_time
        end_time = current_time + timedelta(seconds=duration)

        def format_td(td):
            total_sec = int(td.total_seconds())
            ms = int(td.microseconds / 1000)
            hours, remainder = divmod(total_sec, 3600)
            mins, secs = divmod(remainder, 60)
            return f"{hours:02}:{mins:02}:{secs:02},{ms:03}"

        srt_content += f"{i + 1}\n{format_td(start_time)} --> {format_td(end_time)}\n{chunk.text}\n\n"
        current_time = end_time

    return srt_content, current_time.total_seconds()


@app.get("/api/v2/books/{book_id}/download-full")
async def download_full_book(book_id: str):
    audio_dir = "oas_assets/audio"
    output_wav = os.path.join(audio_dir, f"full_{book_id}.wav")
    output_mp4 = os.path.join(audio_dir, f"video_{book_id}.mp4")
    srt_file = os.path.join(audio_dir, f"sub_{book_id}.srt")
    list_file = os.path.join(audio_dir, f"list_{book_id}.txt")

    with SessionLocal() as db:
        book = db.query(Book).filter(Book.id == book_id).first()
        chunks = db.query(Chunk).filter(Chunk.book_id == book_id, Chunk.status == "completed").order_by(
            Chunk.index).all()

        if not chunks:
            return {"error": "Sentezlenmiş parça bulunamadı. Lütfen önce seslendirmeyi tamamlayın."}

        with open(list_file, "w", encoding="utf-8") as f:
            for c in chunks:
                f.write(f"file '{book_id}_{c.index}.wav'\n")

        subprocess.run([FFMPEG_PATH, '-y', '-f', 'concat', '-safe', '0', '-i', list_file, '-c', 'copy', output_wav],
                       check=True)

        srt_data, total_duration = generate_srt(chunks)
        with open(srt_file, "w", encoding="utf-8") as f:
            f.write(srt_data)

        try:
            srt_path_fixed = srt_file.replace("\\", "/").replace(":", "\\:")

            cmd = [
                FFMPEG_PATH, '-y',
                '-f', 'lavfi', '-i', 'color=c=0x0f172a:s=1280x720:r=25',  # Slate-900 UI Teması
                '-i', output_wav,
                '-vf',
                f"subtitles='{srt_path_fixed}':force_style='Alignment=2,FontSize=22,MarginV=140,Outline=0,Shadow=0,PrimaryColour=&HFFFFFF'",
                '-c:v', 'h264_nvenc',  # GPU Encoding
                '-c:a', 'aac', '-b:a', '192k',
                '-shortest',
                output_mp4
            ]

            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True,
                                       encoding='utf-8')

            print(f"\n[SYSTEM] Video Render Başlatıldı: {book.title if book else 'Unknown'}")

            for line in process.stdout:
                if "time=" in line:
                    time_match = re.search(r"time=(\d+):(\d+):(\d+.\d+)", line)
                    if time_match:
                        h, m, s = map(float, time_match.groups())
                        current_seconds = h * 3600 + m * 60 + s
                        percentage = (current_seconds / total_duration) * 100
                        sys.stdout.write(
                            f"\rİlerleme: %{percentage:.2f} | {int(current_seconds)}/{int(total_duration)} saniye")
                        sys.stdout.flush()

            process.wait()
            print(f"\n[SYSTEM] Video Başarıyla Oluşturuldu: {output_mp4}\n")

        except Exception as e:
            logger.error(f"Video kodlama hatası: {e}")
            return {"error": "Render işlemi başarısız oldu."}

    return FileResponse(
        path=output_mp4,
        media_type='video/mp4',
        filename=f"{book.title if book else 'EBook'}_Video.mp4"
    )


@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    await tts_service.start_worker()


app.include_router(api_router, prefix="/api/v2")


@app.get("/api/v2/books/{book_id}/download/{chunk_index}")
async def download_audio(book_id: str, chunk_index: int):
    file_path = f"oas_assets/audio/{book_id}_{chunk_index}.wav"
    if not os.path.exists(file_path):
        return {"error": "Dosya bulunamadı."}
    return FileResponse(path=file_path, media_type='audio/wav', filename=f"Part_{chunk_index}.wav")


@app.get("/")
async def root():
    return {"message": "ReaderAudioAPI v2 Online", "hardware_accel": "RTX 4060 NVENC"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
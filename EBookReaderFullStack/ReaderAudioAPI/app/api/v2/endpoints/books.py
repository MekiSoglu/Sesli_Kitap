import os
import re
import uuid
import shutil
from typing import List
from app.core.constants import resolve_ffmpeg_path
import subprocess

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

from app.core.database import get_db, SessionLocal
from app.models.book import Book, Chunk
from app.schemas.book import BookSchema, BookSummary, ChunkSchema
from app.services.tts import tts_service

import os
import subprocess

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.book import Chunk
from app.utils.srt import generate_sentence_srt

router = APIRouter()

UPLOAD_DIR = "oas_assets/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============================
# TEXT NORMALIZATION
# ============================

REPLACEMENTS = {
    "Katniss": "Ketnıs",
    "Peeta": "Pita",
    "Gale": "Geyıl",
    "Primrose": "Primroz",
    "Haymitch": "Heymiç",
    "Effie": "Efi",
    "Cinna": "Sinna",
    "Finnick": "Finnik",
    "Johanna": "Cohanna",
    "Beetee": "Biti",
    "Wiress": "Vayres",
    "Mags": "Megz",
    "Cashmere": "Kaşmir",
    "Chaff": "Çaf",
    "Seeder": "Sidır",
    "Blight": "Blayt",
    "Bonnie": "Bonni",
    "Twill": "Tvıl",
    "Madge": "Mec",
    "Portia": "Porşa",
    "Octavia": "Okteyviya",
    "Flavius": "Fleyviyus",
    "Venia": "Venya",
    "Annie": "Eni",
    "Capitol": "Kapitol",
    "Cornucopia": "Kornukopya",
    "Jabberjay": "Cebırcey",
    "Avox": "Evoks",
}

def clean_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)

    text = re.sub(
        r"[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ.,!?;:\s\-\(\)'\"\u2018\u2019\u201c\u201d]",
        " ",
        text,
    )

    for src, tgt in REPLACEMENTS.items():
        text = re.sub(rf"\b{src}\b", tgt, text)

    text = re.sub(r"\s+", " ", text).strip()
    return text


# ============================
# EPUB → CHUNK
# ============================

MAX_CHARS = 180
MIN_CHARS = 30

def extract_chapters_iteratively(epub_path: str):
    book = epub.read_epub(epub_path)

    title = book.get_metadata("DC", "title")[0][0] if book.get_metadata("DC", "title") else "Unknown"
    author = book.get_metadata("DC", "creator")[0][0] if book.get_metadata("DC", "creator") else "Unknown"

    yield {"type": "metadata", "title": title, "author": author}

    buffer = ""

    for item in book.get_items():
        if item.get_type() != ebooklib.ITEM_DOCUMENT:
            continue

        soup = BeautifulSoup(item.get_content(), "html.parser")
        elements = soup.find_all(["p", "h1", "h2", "h3", "h4", "h5"])

        for el in elements:
            text = clean_text(el.get_text())
            if not text:
                continue

            sentences = re.split(r"(?<=[.!?])\s+", text)

            for s in sentences:
                if not s:
                    continue

                if len(s) > MAX_CHARS:
                    words = s.split()
                    temp = ""
                    for w in words:
                        if len(temp) + len(w) + 1 <= MAX_CHARS:
                            temp += " " + w
                        else:
                            if len(temp.strip()) >= MIN_CHARS:
                                yield {"type": "chunk", "content": temp.strip()}
                            temp = w
                    buffer = temp
                    continue

                if len(buffer) + len(s) + 1 <= MAX_CHARS:
                    buffer += (" " if buffer else "") + s
                else:
                    if len(buffer.strip()) >= MIN_CHARS:
                        yield {"type": "chunk", "content": buffer.strip()}
                    buffer = s

    if len(buffer.strip()) >= MIN_CHARS:
        yield {"type": "chunk", "content": buffer.strip()}


# ============================
# BACKGROUND PARSER
# ============================

async def parse_book_background(book_id: str, file_path: str):
    try:
        iterator = extract_chapters_iteratively(file_path)
        meta = next(iterator)

        with SessionLocal() as db:
            book = db.query(Book).filter(Book.id == book_id).first()
            book.title = meta["title"]
            book.author = meta["author"]
            book.status = "parsing"
            db.commit()

        idx = 0
        for item in iterator:
            if item["type"] != "chunk":
                continue

            with SessionLocal() as db:
                db.add(
                    Chunk(
                        book_id=book_id,
                        index=idx,
                        text=item["content"],
                        status="pending",
                        emotion="neutral",
                    )
                )
                db.commit()
            idx += 1

        with SessionLocal() as db:
            book = db.query(Book).filter(Book.id == book_id).first()
            book.status = "analyzing_emotions"
            db.commit()

        await tts_service.add_to_queue(book_id)

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ============================
# API ENDPOINTS
# ============================

@router.post("/upload")
async def upload_book(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_id: str = Form("canan"),
    speed: float = Form(1.0),
    steps: int = Form(10),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".epub"):
        raise HTTPException(400, "Only EPUB supported")

    book_id = str(uuid.uuid4())
    path = os.path.join(UPLOAD_DIR, f"{book_id}.epub")

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    db.add(
        Book(
            id=book_id,
            title="Processing...",
            author="Processing...",
            voice_id=voice_id,
            speed=speed,
            steps=steps,
            status="parsing",
        )
    )
    db.commit()

    background_tasks.add_task(parse_book_background, book_id, path)
    return {"book_id": book_id}


@router.get("/", response_model=List[BookSummary])
def list_books(db: Session = Depends(get_db)):
    return db.query(Book).order_by(Book.created_at.desc()).all()


@router.get("/{book_id}", response_model=BookSchema)
def get_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404)

    total = db.query(Chunk).filter(Chunk.book_id == book_id).count()
    data = BookSchema.from_orm(book)
    data.total_chunks = total
    return data


@router.get("/{book_id}/chunks", response_model=List[ChunkSchema])
def get_chunks(book_id: str, offset: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(Chunk)
        .filter(Chunk.book_id == book_id)
        .order_by(Chunk.index)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{book_id}/audio/{index}")
def get_audio(book_id: str, index: int, db: Session = Depends(get_db)):
    chunk = db.query(Chunk).filter(Chunk.book_id == book_id, Chunk.index == index).first()
    if not chunk or not chunk.audio_path:
        raise HTTPException(404)

    return FileResponse(chunk.audio_path, media_type="audio/wav")



@router.post("/voices/upload")
async def upload_voice(
    file: UploadFile = File(...),
    voice_id: str = Form(...),
    emotion: str = Form(...),
):
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(400, "Only WAV files are supported")

    voice_id = voice_id.lower().replace(" ", "_")
    emotion = emotion.lower().replace(" ", "_")

    speakers_dir = os.path.join("app", "speakers")
    os.makedirs(speakers_dir, exist_ok=True)

    target_path = os.path.join(
        speakers_dir,
        f"{voice_id}_{emotion}.wav"
    )

    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {
        "status": "ok",
        "voice_id": voice_id,
        "emotion": emotion,
        "path": target_path,
    }

@router.get("/{book_id}/download-video")
async def download_video(book_id: str):
    audio_dir = "oas_assets/audio"
    os.makedirs(audio_dir, exist_ok=True)

    wav_path = f"{audio_dir}/full_{book_id}.wav"
    srt_path = f"{audio_dir}/{book_id}.srt"
    mp4_path = f"{audio_dir}/{book_id}.mp4"
    list_path = f"{audio_dir}/{book_id}_list.txt"

    ffmpeg_path = resolve_ffmpeg_path()

    with SessionLocal() as db:
        chunks = (
            db.query(Chunk)
            .filter(Chunk.book_id == book_id, Chunk.status == "completed")
            .order_by(Chunk.index)
            .all()
        )

        if not chunks:
            raise HTTPException(400, "Hazır ses yok")

    with open(list_path, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(f"file '{os.path.abspath(c.audio_path)}'\n")

    subprocess.run(
        [
            ffmpeg_path,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_path,
            "-c", "copy",
            wav_path,
        ],
        check=True,
    )

    srt_data, _ = generate_sentence_srt(chunks)
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_data)

    subprocess.run(
        [
            ffmpeg_path,
            "-y",
            "-f", "lavfi",
            "-i", "color=c=black:s=1280x720:r=25",
            "-i", wav_path,
            "-vf", f"subtitles={srt_path}",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            mp4_path,
        ],
        check=True,
    )

    return FileResponse(
        mp4_path,
        media_type="video/mp4",
        filename="audiobook.mp4",
    )



@router.delete("/{book_id}")
def delete_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")


    chunks = db.query(Chunk).filter(Chunk.book_id == book_id).all()


    audio_dir = "oas_assets/audio"

    for chunk in chunks:
        if chunk.audio_path and os.path.exists(chunk.audio_path):
            try:
                os.remove(chunk.audio_path)
            except Exception:
                pass
        else:
            fallback = os.path.join(audio_dir, f"{book_id}_{chunk.index}.wav")
            if os.path.exists(fallback):
                try:
                    os.remove(fallback)
                except Exception:
                    pass


    for chunk in chunks:
        db.delete(chunk)


    epub_path = os.path.join(UPLOAD_DIR, f"{book_id}.epub")
    if os.path.exists(epub_path):
        try:
            os.remove(epub_path)
        except Exception:
            pass


    db.delete(book)
    db.commit()

    return {"status": "deleted", "book_id": book_id}




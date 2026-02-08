# ReaderAudioAPI

A FastAPI backend for the Supertonic TTS engine, supporting EPUB processing and background audio generation.

## Features
- **EPUB Upload**: Automatically extracts text, splits into paragraphs/chunks.
- **Persistent Storage**: Uses SQLite to track books, chunks, and progress.
- **Background Worker**: Processes TTS chunks in a queue. Automatically detects GPU (CUDA) or falls back to CPU.
- **Streaming Updates**: Real-time status updates via SSE (Server-Sent Events).
- **Auto-Resume**: Automatically resumes unfinished books on startup.
- **Chunk Management**: Retrieve specific audio chunks and word-level timestamps.

## Setup

1. **Backend**:
   ```bash
   cd ReaderAudioAPI
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**:
   ```bash
   cd reader-frontend
   npm install
   npm run dev
   ```

## Folder Structure
- `ReaderAudioAPI/`: FastAPI v2 Backend.
- `reader-frontend/`: Next.js 14 Frontend with Tailwind & Lucide.

## API Endpoints

- `POST /upload`: Upload an `.epub` file + TTS settings (`voice_id`, `speed`, `steps`).
- `GET /books`: List all uploaded books and their status.
- `GET /books/{book_id}`: Get full book details and chunk metadata.
- `GET /audio/{book_id}/{chunk_index}`: Get the `.wav` file for a specific chunk.
- `GET /stream/{book_id}`: SSE stream for real-time completion events.
- `POST /books/{book_id}/resume`: Manually resume processing.

## Project Structure
- `main.py`: FastAPI endpoints and SSE logic.
- `database.py`: SQLAlchemy models for Books and Chunks.
- `tts_service.py`: Background worker and TTS engine integration.
- `utils.py`: EPUB parsing and text chunking logic.
- `oas_assets/`: Storage for generated audio and temporary uploads.

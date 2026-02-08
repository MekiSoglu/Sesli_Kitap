import os
import torch
import asyncio
import logging
import time
import wave

from TTS.api import TTS
from app.core.database import SessionLocal
from app.models.book import Book, Chunk
from app.services.llama_emotion import llama_service

logger = logging.getLogger(__name__)


# -------------------------------------------------
# Bu fonksiyon ileride duyguya göre
# noktalama / duraksama eklemek için bırakıldı.
# Şu an XTTS zaten noktalama hassas olduğu için
# metni olduğu gibi döndürüyoruz.
#
# Örnek ileride:
# sad  -> "..." uzatmaları
# angry -> daha sert kesmeler
# -------------------------------------------------
def apply_emotion_pauses(text: str, emotion: str) -> str:
    return text


# -------------------------------------------------
# WAV dosyasının süresini saniye cinsinden okur.
# Chunk sürelerini DB’ye yazmak için kullanılır.
# Video / SRT senkronu için kritik.
# -------------------------------------------------
def get_wav_duration_seconds(path: str):
    try:
        with wave.open(path, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / float(rate) if rate else None
    except Exception as e:
        logger.warning(f"WAV duration okunamadı: {path} | {e}")
        return None


class TTSService:
    """
    XTTS v2 tabanlı merkezi TTS servisi.

    - Singleton çalışır (tek model instance)
    - Async queue üzerinden kitap bazlı iş alır
    - Chunk → WAV üretir
    - Emotion + speaker wav destekler
    """

    _instance = None

    # -------------------------------------------------
    # Singleton pattern
    # -------------------------------------------------
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        # Aynı instance tekrar init edilmesin
        if self.initialized:
            return

        # CUDA varsa GPU kullanılır
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Üretilen WAV’lerin yazıldığı klasör
        self.output_dir = "oas_assets/audio"

        # Referans seslerin olduğu klasör
        # Format: voice_emotion.wav
        self.speakers_dir = os.path.join("app", "speakers")

        os.makedirs(self.output_dir, exist_ok=True)

        # Async iş kuyruğu (kitap ID alır)
        self.queue = asyncio.Queue()

        # Worker task (tek worker yeterli)
        self.worker_task = None

        # XTTS model instance (lazy load)
        self.tts = None

        self.initialized = True


    # -------------------------------------------------
    # İlgili ses + duygu için speaker wav bulur
    #
    # Öncelik:
    #   voice_emotion.wav
    #   voice_neutral.wav
    #
    # Örn:
    #   canan_happy.wav
    #   canan_neutral.wav
    # -------------------------------------------------
    def resolve_speaker_wav(self, voice_id: str, emotion: str) -> str | None:

        voice_id = voice_id.lower().replace(" ", "_")
        emotion = emotion.lower()

        primary = os.path.join(self.speakers_dir, f"{voice_id}_{emotion}.wav")
        fallback = os.path.join(self.speakers_dir, f"{voice_id}_neutral.wav")

        if os.path.exists(primary):
            return primary

        if os.path.exists(fallback):
            return fallback

        return None


    # -------------------------------------------------
    # Worker’ı başlatır
    # App startup’ta bir kere çağrılması yeterli
    # -------------------------------------------------
    async def start_worker(self):
        if self.worker_task is None:
            self.worker_task = asyncio.create_task(self._worker())
            logger.info(
                f"TTS Worker başlatıldı | Device={self.device}"
            )


    # -------------------------------------------------
    # Sonsuz dönen worker
    # Queue’dan kitap ID alır
    # -------------------------------------------------
    async def _worker(self):
        while True:
            book_id = await self.queue.get()
            try:
                await self.process_book(book_id)
            except Exception as e:
                logger.error(f"Worker hatası: {e}", exc_info=True)
            finally:
                self.queue.task_done()


    # -------------------------------------------------
    # Kitabı kuyruğa ekler
    # EPUB parse bittikten sonra çağrılır
    # -------------------------------------------------
    async def add_to_queue(self, book_id: str):
        await self.queue.put(book_id)


    # -------------------------------------------------
    # Ana iş mantığı
    #
    # Akış:
    # 1) LLaMA emotion analizi
    # 2) XTTS model yükle (ilk seferde)
    # 3) Pending chunk’ları sırayla sentezle
    # 4) WAV üret → duration hesapla → DB’ye yaz
    # -------------------------------------------------
    async def process_book(self, book_id: str):
        logger.info(f"Duygu analizi başlatılıyor: {book_id}")
        await llama_service.analyze_book_emotions(book_id)

        # XTTS model lazy-load
        if self.tts is None:
            logger.info("XTTS v2 yükleniyor...")
            self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
            if self.device == "cuda":
                self.tts.to(self.device)
                logger.info("CUDA aktif")

        # Duygu bazlı hız / sıcaklık ayarları
        # Bu değerler sesin doğal hissini ciddi etkiler
        emotion_settings = {
            "happy":   {"speed": 1.05, "temp": 0.95},
            "sad":     {"speed": 0.98, "temp": 0.90},
            "angry":   {"speed": 1.10, "temp": 0.82},
            "neutral": {"speed": 1.00, "temp": 0.90},
        }

        with SessionLocal() as db:
            book = db.query(Book).filter(Book.id == book_id).first()
            if not book:
                logger.warning(f"Kitap bulunamadı: {book_id}")
                return

            voice_id = book.voice_id or "canan"

            book.status = "processing"
            db.commit()

            # Sadece pending chunk’lar işlenir
            chunks = (
                db.query(Chunk)
                .filter(Chunk.book_id == book_id, Chunk.status == "pending")
                .order_by(Chunk.index)
                .all()
            )

            if not chunks:
                book.status = "completed"
                db.commit()
                return

            # Chunk’lar sıralı işlenir (audio continuity için önemli)
            for chunk in chunks:
                try:
                    start_time = time.time()

                    emotion = (
                        chunk.emotion
                        if chunk.emotion in emotion_settings
                        else "neutral"
                    )
                    settings = emotion_settings[emotion]

                    speaker_wav = self.resolve_speaker_wav(voice_id, emotion)
                    if not speaker_wav:
                        raise FileNotFoundError(
                            f"Speaker WAV yok | voice={voice_id} emotion={emotion}"
                        )

                    processed_text = apply_emotion_pauses(chunk.text, emotion)
                    file_path = os.path.join(
                        self.output_dir,
                        f"{book_id}_{chunk.index}.wav"
                    )

                    logger.info(
                        f"Sentez | Chunk={chunk.index} | "
                        f"Voice={voice_id} | Emotion={emotion} | "
                        f"Speaker={os.path.basename(speaker_wav)}"
                    )

                    # Torch inference mode (gradients kapalı)
                    with torch.inference_mode():
                        self.tts.tts_to_file(
                            text=processed_text,
                            speaker_wav=speaker_wav,
                            language="tr",
                            file_path=file_path,
                            speed=settings["speed"],
                            temperature=settings["temp"],
                            repetition_penalty=1.1
                        )

                    # WAV süresi hesaplanır (SRT / video için)
                    duration = get_wav_duration_seconds(file_path)
                    if duration:
                        chunk.duration = float(duration)

                    chunk.audio_path = file_path
                    chunk.status = "completed"
                    db.commit()

                    logger.info(
                        f"Chunk {chunk.index} tamamlandı "
                        f"({time.time() - start_time:.2f}s)"
                    )

                except Exception as e:
                    logger.error(
                        f"Sentez hatası | Chunk {chunk.index}: {e}",
                        exc_info=True
                    )
                    chunk.status = "failed"
                    db.commit()

            book.status = "completed"
            db.commit()
            logger.info(f"Kitap tamamlandı | book={book_id}")


# Global singleton instance
tts_service = TTSService()

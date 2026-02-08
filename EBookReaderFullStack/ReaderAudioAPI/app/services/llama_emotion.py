import httpx
import logging
from sqlalchemy.orm import Session
from app.models.book import Book, Chunk
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


class LlamaEmotionService:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.system_prompt = (
            "Sen bir duygu analiz uzmanısın. Sana verilen metni analiz et ve "
            "SADECE şu dört kelimeden birini dön: happy, sad, neutral , excited. "
            "Asla açıklama yapma, sadece tek bir kelime yaz."
        )

    async def analyze_book_emotions(self, book_id: str):
        with SessionLocal() as db:
            chunks = db.query(Chunk).filter(
                Chunk.book_id == book_id,
                Chunk.emotion == "neutral"
            ).order_by(Chunk.index).all()

            if not chunks:
                logger.info(f"Kitap {book_id} için analiz edilecek parça kalmadı.")
                return

            logger.info(f"Llama 3 analizi başlıyor: {len(chunks)} parça işlenecek.")

            for chunk in chunks:
                emotion = await self._get_emotion(chunk.text)
                chunk.emotion = emotion
                db.commit()

            logger.info(f"Kitap {book_id} duygu analizi tamamlandı.")

    async def _get_emotion(self, text: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": "llama3.1:8b-instruct-q5_K_M",
                        "prompt": f"{self.system_prompt}\n\nMetin: {text}",
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "top_p": 0.9
                        }
                    }
                )
                if response.status_code == 200:
                    result = response.json().get("response", "neutral").strip().lower()
                    result = "".join(filter(str.isalpha, result))

                    if result in ["happy", "sad", "angry", "neutral"]:
                        return result
                return "neutral"
        except Exception as e:
            logger.error(f"Llama API bağlantı hatası: {e}")
            return "neutral"


llama_service = LlamaEmotionService()
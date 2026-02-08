from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
import datetime
from app.core.database import Base


class Book(Base):
    __tablename__ = "books"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String, nullable=True)
    voice_id = Column(String, default="M3")
    speed = Column(Float, default=1.0)
    steps = Column(Integer, default=10)
    status = Column(String, default="pending")
    last_chunk_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    chunks = relationship("Chunk", back_populates="book", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    book_id = Column(String, ForeignKey("books.id"))
    index = Column(Integer)
    text = Column(Text)
    audio_path = Column(String, nullable=True)


    emotion = Column(String, default="neutral", nullable=False)

    word_timestamps = Column(JSON, nullable=True)
    duration = Column(Float, nullable=True)
    status = Column(String, default="pending")

    book = relationship("Book", back_populates="chunks")
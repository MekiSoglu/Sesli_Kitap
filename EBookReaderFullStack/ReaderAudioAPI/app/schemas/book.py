from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class VoiceStyleSchema(BaseModel):
    id: str
    name: str
    gender: str
    description: str

class ChunkSchema(BaseModel):
    index: int
    text: str
    status: str
    duration: Optional[float] = None
    word_timestamps: Optional[List[dict]] = None

    class Config:
        from_attributes = True

class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    voice_id: str
    speed: float
    steps: int

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    status: Optional[str] = None
    last_chunk_index: Optional[int] = None

class BookSchema(BookBase):
    id: str
    status: str
    last_chunk_index: int
    created_at: datetime
    total_chunks: Optional[int] = 0

    class Config:
        from_attributes = True

class BookWithChunksSchema(BookSchema):
    chunks: List[ChunkSchema] = []

class BookSummary(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

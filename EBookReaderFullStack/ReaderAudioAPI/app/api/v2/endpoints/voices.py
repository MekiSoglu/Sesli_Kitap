from fastapi import APIRouter
from typing import List
from app.core.constants import VoiceStyle, load_voice_styles


router = APIRouter(tags=["voices"])

@router.get("/", response_model=List[VoiceStyle])
def list_voices():
    return load_voice_styles()
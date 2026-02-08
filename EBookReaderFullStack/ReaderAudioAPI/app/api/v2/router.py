from fastapi import APIRouter
from app.api.v2.endpoints import books, voices, settings

api_router = APIRouter()
api_router.include_router(books.router, prefix="/books", tags=["books"])
api_router.include_router(voices.router, prefix="/voices", tags=["voices"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])

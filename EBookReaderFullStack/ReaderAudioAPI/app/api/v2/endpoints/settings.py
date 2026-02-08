from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import json

from app.core.database import get_db
from app.models.user_setting import UserSetting

router = APIRouter()

@router.get("/")
async def get_settings(db: Session = Depends(get_db)):
    settings = db.query(UserSetting).all()
    return {s.key: json.loads(s.value) for s in settings}

@router.post("/")
async def update_settings(settings: Dict[str, Any], db: Session = Depends(get_db)):
    for key, value in settings.items():
        db_setting = db.query(UserSetting).filter(UserSetting.key == key).first()
        if db_setting:
            db_setting.value = json.dumps(value)
        else:
            db_setting = UserSetting(key=key, value=json.dumps(value))
            db.add(db_setting)
    db.commit()
    return {"status": "success"}

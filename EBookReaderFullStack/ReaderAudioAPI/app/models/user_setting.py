from sqlalchemy import Column, String, Text
from app.core.database import Base

class UserSetting(Base):
    __tablename__ = "user_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(Text)

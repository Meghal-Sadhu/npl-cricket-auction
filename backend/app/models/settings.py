from sqlalchemy import Column, Integer, String, Text
from app.database import Base

class ApplicationSettings(Base):
    __tablename__ = "application_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)

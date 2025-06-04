from fastapi import FastAPI, Request, Depends, Cookie, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import logging
import re
import uuid as uuid_lib

import os
import httpx
import asyncpg
from pydantic import BaseModel, validator

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Конфигурация приложения
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL не установлен")
    raise ValueError("DATABASE_URL не установлен")


# Настройка CORS origins
origins = os.environ.get("CORS_ORIGINS", "http://localhost:5500")
allow_origins = [origin.strip() for origin in origins.split(",")]
logger.info(f"Разрешенные CORS origins: {allow_origins}")


# Инициализация FastAPI приложения
app = FastAPI(
    title="Wheatherly",
    description="API для получения прогноза погоды",
    version="1.0.0"
)

# Настройка CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],  
    allow_headers=["*"],
)

# === ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ === #

class WeatherRequest(BaseModel):
    city: str
    lat: float
    lon: float
    
    @validator('city')
    def validate_city(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Название города не может быть пустым')
        if len(v) > 100:
            raise ValueError('Название города слишком длинное (максимум 100 символов)')
        # Разрешаем только буквы, цифры, пробелы и базовые символы
        if not re.match(r'^[a-zA-Zа-яА-Я0-9\s\-_.,]+$', v):
            raise ValueError('Недопустимые символы в названии города')
        return v.strip()
    
    @validator('lat')
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Широта должна быть от -90 до 90')
        return v
    
    @validator('lon')
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Долгота должна быть от -180 до 180')

def validate_user_uuid(request: Request) -> str:
    """
    Строгая валидация UUID пользователя.
    
    Returns:
        str: Валидный UUID
        
    Raises:
        HTTPException: Если UUID невалидный
    """
    uuid_header = request.headers.get('X-User-UUID')
    
    if not uuid_header:
        logger.warning("Запрос без X-User-UUID заголовка")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация"
        )
    
    # ✅ Строгая валидация UUID формата
    try:
        validated_uuid = str(uuid_lib.UUID(uuid_header))
        return validated_uuid
    except ValueError:
        logger.warning(f"Невалидный UUID: {uuid_header[:20]}...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невалидный формат идентификатора пользователя"
        )

# === ЗАВИСИМОСТИ === #

async def get_db():
    """
    Подключение к базе данных PostgreSQL.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        yield conn
    except Exception as e:
        logger.error(f"Ошибка подключения к базе данных: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ошибка подключения к базе данных"
        )
    finally:
        await conn.close()




@app.get("/get_weather")
async def get_weather(request: Request, city: str, lat: float, lon: float, db=Depends(get_db)):
    """
    Возвращает прогноз погоды на ближайшее время по координатам (Open-Meteo)
    Также сохраняет запрос в историю пользователя и обновляет статистику по городам.
    """

    # ✅ Валидация входных данных
    weather_req = WeatherRequest(city=city, lat=lat, lon=lon)
    user_uuid = validate_user_uuid(request)

    
    # Сохраняем историю пользователя
    await db.execute(
        "INSERT INTO history (user_id, city, lat, lon) VALUES ($1, $2, $3, $4)",
        user_uuid, city, lat, lon
    )

    # Обновляем статистику по городам
    await db.execute(
        """
        INSERT INTO city_stats (city, count)
        VALUES ($1, 1)
        ON CONFLICT (city) DO UPDATE SET count = city_stats.count + 1
        """,
        city
    )

    # Формируем URL для получения прогноза погоды
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=5"
    )
    logger.debug(f"Запрос к Open-Meteo API: {url}")

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        logger.info(f"Успешно получен прогноз для {city}")
        return data



#получение истории поиска пользователя
@app.get("/history")
async def history(
    request: Request,
    response: Response,
    db=Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Возвращает историю поиска погоды для пользователя.
    """
    # Получаем UUID пользователя
    user_uuid = validate_user_uuid(request)

    # Формируем запрос к базе данных
    query = """
        SELECT city, lat, lon, searched_at
        FROM history
        WHERE user_id = $1
        ORDER BY searched_at DESC
    """
    rows = await db.fetch(query, user_uuid)
    logger.info(f"Возвращаем историю для {user_uuid}")
    return [
        {
            "city": row["city"],
            "lat": row["lat"],
            "lon": row["lon"]
        } for row in rows
    ]

#получение статистики по городам
#curl -s https://wheatherly.onrender.com/stats | jq
@app.get("/stats")
async def stats(db=Depends(get_db)):
    """
    Возвращает статистику поиска по городам.
    """
    logger.info("Запрос статистики по городам")
    rows = await db.fetch("SELECT city, count FROM city_stats ORDER BY count DESC LIMIT 100")
    #TODO: разобораться почему fastapi не возвращает кодировку utf-8
    return JSONResponse(
        content={row["city"]: row["count"] for row in rows},
        media_type="application/json; charset=utf-8"
    )

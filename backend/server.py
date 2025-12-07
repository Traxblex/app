import os
import logging
import uuid
import secrets
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
import httpx

# --- Imports SQL Alchemy ---
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, JSON, DateTime, select, delete, update, func

# 1. Configuration et Database
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DATABASE_URL = os.environ['DATABASE_URL']
DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID')
DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET')
DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI', '')

# Moteur DB
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Base pour les modèles ORM
class Base(DeclarativeBase):
    pass

# Dependency pour récupérer la session DB
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============== MODÈLES SQLALCHEMY (TABLES) ==============

class DBUser(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    discord_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    access_token: Mapped[str] = mapped_column(String(255))
    refresh_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

class DBAnime(Base):
    __tablename__ = "animes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, unique=True)
    title: Mapped[str] = mapped_column(String(255))
    title_japanese: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    synopsis: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    cover_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    banner_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    genres: Mapped[List[str]] = mapped_column(JSON, default=list) # Stocké en JSON
    status: Mapped[str] = mapped_column(String(50), default="ongoing")
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    episodes: Mapped[List[dict]] = mapped_column(JSON, default=list) # Stocké en JSON pour simplicité
    total_episodes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(50), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

class DBWatchlist(Base):
    __tablename__ = "watchlist"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    anime_id: Mapped[str] = mapped_column(String(36))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

class DBFavorite(Base):
    __tablename__ = "favorites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    anime_id: Mapped[str] = mapped_column(String(36))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

class DBHistory(Base):
    __tablename__ = "history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    anime_id: Mapped[str] = mapped_column(String(36))
    episode_number: Mapped[int] = mapped_column(Integer)
    progress: Mapped[float] = mapped_column(Float, default=0)
    watched_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

# ============== PYDANTIC SCHEMAS (API) ==============
# (On garde les mêmes que ton code original pour la compatibilité Frontend)
class User(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True) # Ajout de from_attributes
    id: str
    username: str
    avatar: Optional[str] = None

class AnimeCreate(BaseModel):
    title: str
    title_japanese: Optional[str] = None
    synopsis: Optional[str] = None
    cover_image: Optional[str] = None
    banner_image: Optional[str] = None
    genres: List[str] = []
    status: str = "ongoing"
    rating: Optional[float] = None
    year: Optional[int] = None
    total_episodes: Optional[int] = None
    is_featured: bool = False

class EpisodeCreate(BaseModel):
    number: int
    title: str
    video_url: str
    thumbnail: Optional[str] = None
    duration: Optional[str] = None

# ============== AUTH ROUTES ==============

@api_router.get("/auth/discord")
async def discord_login():
    state = secrets.token_urlsafe(16)
    discord_auth_url = (
        f"https://discord.com/api/oauth2/authorize?"
        f"client_id={DISCORD_CLIENT_ID}&"
        f"redirect_uri={DISCORD_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=identify%20email&"
        f"state={state}"
    )
    return {"auth_url": discord_auth_url, "state": state}

@api_router.get("/auth/discord/callback")
async def discord_callback(code: str, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client_http:
        # 1. Get Token
        token_response = await client_http.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        token_data = token_response.json()
        
        # 2. Get User Info
        user_response = await client_http.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        discord_user = user_response.json()
        avatar_url = f"https://cdn.discordapp.com/avatars/{discord_user['id']}/{discord_user['avatar']}.png" if discord_user.get("avatar") else None

        # 3. Save/Update in MySQL
        stmt = select(DBUser).where(DBUser.discord_id == discord_user["id"])
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            user.username = discord_user["username"]
            user.email = discord_user.get("email")
            user.avatar = avatar_url
            user.access_token = token_data["access_token"]
            user.refresh_token = token_data.get("refresh_token")
        else:
            user = DBUser(
                discord_id=discord_user["id"],
                username=discord_user["username"],
                email=discord_user.get("email"),
                avatar=avatar_url,
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token")
            )
            db.add(user)
        
        await db.commit()
        await db.refresh(user)

        return {
            "user_id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "email": user.email,
            "access_token": user.access_token
        }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBUser).where(DBUser.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============== ANIME ROUTES ==============

@api_router.get("/anime")
async def get_anime_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    genre: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(DBAnime)
    
    # Filtre "Sale" pour JSON (MySQL 5.7+ supporte JSON_CONTAINS, ici on fait simple en Python post-filter ou LIKE si string)
    # Note: Filtrer du JSON en SQL pur est complexe sans fonctions spécifiques.
    # Ici, pour rester simple, on utilise des filtres basiques.
    
    if status:
        query = query.where(DBAnime.status == status)
    if featured is not None:
        query = query.where(DBAnime.is_featured == featured)
    if search:
        query = query.where(DBAnime.title.ilike(f"%{search}%"))

    # Pagination
    total_stmt = select(func.count()).select_from(query.subquery())
    total = await db.scalar(total_stmt) or 0

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    animes = result.scalars().all()

    # Filtrage manuel du genre car c'est un JSON list (solution temporaire simple)
    if genre:
        animes = [a for a in animes if genre in a.genres]

    return {
        "data": animes,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/anime/featured")
async def get_featured_anime(db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).where(DBAnime.is_featured == True).limit(10)
    result = await db.execute(stmt)
    return result.scalars().all()

@api_router.get("/anime/trending")
async def get_trending_anime(db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).order_by(DBAnime.rating.desc()).limit(10)
    result = await db.execute(stmt)
    return result.scalars().all()

@api_router.get("/anime/recent")
async def get_recent_anime(db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).order_by(DBAnime.created_at.desc()).limit(10)
    result = await db.execute(stmt)
    return result.scalars().all()

@api_router.get("/anime/genres")
async def get_genres(db: AsyncSession = Depends(get_db)):
    # Récupérer tous les genres et les aplatir (opération lourde en SQL, simplifiée ici)
    stmt = select(DBAnime.genres)
    result = await db.execute(stmt)
    all_genres_lists = result.scalars().all()
    unique_genres = set()
    for g_list in all_genres_lists:
        unique_genres.update(g_list)
    return list(unique_genres)

@api_router.get("/anime/{anime_id}")
async def get_anime(anime_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).where(DBAnime.id == anime_id)
    result = await db.execute(stmt)
    anime = result.scalar_one_or_none()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    return anime

@api_router.post("/anime")
async def create_anime(anime_data: AnimeCreate, db: AsyncSession = Depends(get_db)):
    new_anime = DBAnime(**anime_data.model_dump(), source="manual")
    db.add(new_anime)
    await db.commit()
    return {"id": new_anime.id, "message": "Anime created successfully"}

# ============== EPISODE ROUTES ==============
# Note: Ici episodes est un JSON. On update le JSON entier.

@api_router.post("/anime/{anime_id}/episodes")
async def add_episode(anime_id: str, episode_data: EpisodeCreate, db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).where(DBAnime.id == anime_id)
    result = await db.execute(stmt)
    anime = result.scalar_one_or_none()
    
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    
    # SQLAlchemy détecte mal les changements internes aux JSON mutable, on copie
    current_episodes = list(anime.episodes)
    current_episodes.append(episode_data.model_dump())
    
    # On force la mise à jour
    anime.episodes = current_episodes
    
    # Update explicite parfois nécessaire avec JSON selon le driver
    stmt_update = update(DBAnime).where(DBAnime.id == anime_id).values(episodes=current_episodes)
    await db.execute(stmt_update)
    await db.commit()
    
    return {"message": "Episode added successfully"}

@api_router.get("/anime/{anime_id}/episodes")
async def get_episodes(anime_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBAnime).where(DBAnime.id == anime_id)
    result = await db.execute(stmt)
    anime = result.scalar_one_or_none()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    return anime.episodes

# ============== WATCHLIST & FAVORITES ==============

@api_router.get("/user/{user_id}/watchlist")
async def get_watchlist(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBWatchlist).where(DBWatchlist.user_id == user_id)
    result = await db.execute(stmt)
    watchlist_items = result.scalars().all()
    
    if not watchlist_items:
        return []

    ids = [item.anime_id for item in watchlist_items]
    stmt_anime = select(DBAnime).where(DBAnime.id.in_(ids))
    result_anime = await db.execute(stmt_anime)
    return result_anime.scalars().all()

@api_router.post("/user/{user_id}/watchlist/{anime_id}")
async def add_to_watchlist(user_id: str, anime_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBWatchlist).where(DBWatchlist.user_id == user_id, DBWatchlist.anime_id == anime_id)
    existing = await db.scalar(stmt)
    if existing:
        raise HTTPException(status_code=400, detail="Already in watchlist")
    
    new_item = DBWatchlist(user_id=user_id, anime_id=anime_id)
    db.add(new_item)
    await db.commit()
    return {"message": "Added to watchlist"}

@api_router.delete("/user/{user_id}/watchlist/{anime_id}")
async def remove_from_watchlist(user_id: str, anime_id: str, db: AsyncSession = Depends(get_db)):
    stmt = delete(DBWatchlist).where(DBWatchlist.user_id == user_id, DBWatchlist.anime_id == anime_id)
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    return {"message": "Removed from watchlist"}

@api_router.get("/user/{user_id}/watchlist/{anime_id}/check")
async def check_watchlist(user_id: str, anime_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DBWatchlist).where(DBWatchlist.user_id == user_id, DBWatchlist.anime_id == anime_id)
    existing = await db.scalar(stmt)
    return {"in_watchlist": existing is not None}

# (Faire de même pour Favorites et History avec la logique SQL select/insert/delete)

# ============== INITIALISATION DB ==============

@app.on_event("startup")
async def startup():
    # Crée les tables si elles n'existent pas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
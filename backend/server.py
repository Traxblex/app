from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Discord OAuth2 Config
DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID')
DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET')
DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI', '')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discord_id: str
    username: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    access_token: str
    refresh_token: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Episode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    number: int
    title: str
    video_url: str
    thumbnail: Optional[str] = None
    duration: Optional[str] = None

class Anime(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mal_id: Optional[int] = None
    title: str
    title_japanese: Optional[str] = None
    synopsis: Optional[str] = None
    cover_image: Optional[str] = None
    banner_image: Optional[str] = None
    genres: List[str] = []
    status: str = "ongoing"
    rating: Optional[float] = None
    year: Optional[int] = None
    episodes: List[Episode] = []
    total_episodes: Optional[int] = None
    is_featured: bool = False
    source: str = "manual"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class WatchlistItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    anime_id: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WatchHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    anime_id: str
    episode_number: int
    progress: float = 0
    watched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Favorite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    anime_id: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== AUTH ROUTES ==============

@api_router.get("/auth/discord")
async def discord_login():
    """Redirect to Discord OAuth2"""
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
async def discord_callback(code: str, state: Optional[str] = None):
    """Handle Discord OAuth2 callback"""
    async with httpx.AsyncClient() as client_http:
        # Exchange code for token
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
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        
        # Get user info
        user_response = await client_http.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        discord_user = user_response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"discord_id": discord_user["id"]}, {"_id": 0})
        
        avatar_url = None
        if discord_user.get("avatar"):
            avatar_url = f"https://cdn.discordapp.com/avatars/{discord_user['id']}/{discord_user['avatar']}.png"
        
        if existing_user:
            # Update user
            await db.users.update_one(
                {"discord_id": discord_user["id"]},
                {"$set": {
                    "username": discord_user["username"],
                    "email": discord_user.get("email"),
                    "avatar": avatar_url,
                    "access_token": access_token,
                    "refresh_token": refresh_token
                }}
            )
            user_id = existing_user["id"]
        else:
            # Create new user
            user = User(
                discord_id=discord_user["id"],
                username=discord_user["username"],
                email=discord_user.get("email"),
                avatar=avatar_url,
                access_token=access_token,
                refresh_token=refresh_token
            )
            doc = user.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc)
            user_id = user.id
        
        # Return user data
        return {
            "user_id": user_id,
            "username": discord_user["username"],
            "avatar": avatar_url,
            "email": discord_user.get("email"),
            "access_token": access_token
        }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    """Get user by ID"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "access_token": 0, "refresh_token": 0})
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
    featured: Optional[bool] = None
):
    """Get list of anime with filters"""
    query = {}
    
    if genre:
        query["genres"] = {"$in": [genre]}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"title_japanese": {"$regex": search, "$options": "i"}}
        ]
    if featured is not None:
        query["is_featured"] = featured
    
    skip = (page - 1) * limit
    total = await db.anime.count_documents(query)
    anime_list = await db.anime.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "data": anime_list,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/anime/featured")
async def get_featured_anime():
    """Get featured anime for hero section"""
    anime_list = await db.anime.find({"is_featured": True}, {"_id": 0}).to_list(10)
    return anime_list

@api_router.get("/anime/trending")
async def get_trending_anime():
    """Get trending anime"""
    anime_list = await db.anime.find({}, {"_id": 0}).sort("rating", -1).to_list(10)
    return anime_list

@api_router.get("/anime/recent")
async def get_recent_anime():
    """Get recently added anime"""
    anime_list = await db.anime.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return anime_list

@api_router.get("/anime/genres")
async def get_genres():
    """Get all available genres"""
    genres = await db.anime.distinct("genres")
    return genres

@api_router.get("/anime/{anime_id}")
async def get_anime(anime_id: str):
    """Get anime by ID"""
    anime = await db.anime.find_one({"id": anime_id}, {"_id": 0})
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    return anime

@api_router.post("/anime")
async def create_anime(anime_data: AnimeCreate):
    """Create new anime (admin)"""
    anime = Anime(**anime_data.model_dump(), source="manual")
    doc = anime.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.anime.insert_one(doc)
    return {"id": anime.id, "message": "Anime created successfully"}

@api_router.put("/anime/{anime_id}")
async def update_anime(anime_id: str, anime_data: AnimeCreate):
    """Update anime (admin)"""
    result = await db.anime.update_one(
        {"id": anime_id},
        {"$set": anime_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anime not found")
    return {"message": "Anime updated successfully"}

@api_router.delete("/anime/{anime_id}")
async def delete_anime(anime_id: str):
    """Delete anime (admin)"""
    result = await db.anime.delete_one({"id": anime_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anime not found")
    return {"message": "Anime deleted successfully"}

# ============== EPISODE ROUTES ==============

@api_router.post("/anime/{anime_id}/episodes")
async def add_episode(anime_id: str, episode_data: EpisodeCreate):
    """Add episode to anime"""
    episode = Episode(**episode_data.model_dump())
    result = await db.anime.update_one(
        {"id": anime_id},
        {"$push": {"episodes": episode.model_dump()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anime not found")
    return {"message": "Episode added successfully"}

@api_router.get("/anime/{anime_id}/episodes")
async def get_episodes(anime_id: str):
    """Get all episodes of an anime"""
    anime = await db.anime.find_one({"id": anime_id}, {"_id": 0, "episodes": 1})
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")
    return anime.get("episodes", [])

@api_router.delete("/anime/{anime_id}/episodes/{episode_number}")
async def delete_episode(anime_id: str, episode_number: int):
    """Delete episode from anime"""
    result = await db.anime.update_one(
        {"id": anime_id},
        {"$pull": {"episodes": {"number": episode_number}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anime not found")
    return {"message": "Episode deleted successfully"}

# ============== WATCHLIST ROUTES ==============

@api_router.get("/user/{user_id}/watchlist")
async def get_watchlist(user_id: str):
    """Get user's watchlist"""
    watchlist = await db.watchlist.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    anime_ids = [item["anime_id"] for item in watchlist]
    anime_list = await db.anime.find({"id": {"$in": anime_ids}}, {"_id": 0}).to_list(100)
    
    return anime_list

@api_router.post("/user/{user_id}/watchlist/{anime_id}")
async def add_to_watchlist(user_id: str, anime_id: str):
    """Add anime to watchlist"""
    existing = await db.watchlist.find_one({"user_id": user_id, "anime_id": anime_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already in watchlist")
    
    item = WatchlistItem(user_id=user_id, anime_id=anime_id)
    doc = item.model_dump()
    doc['added_at'] = doc['added_at'].isoformat()
    await db.watchlist.insert_one(doc)
    return {"message": "Added to watchlist"}

@api_router.delete("/user/{user_id}/watchlist/{anime_id}")
async def remove_from_watchlist(user_id: str, anime_id: str):
    """Remove anime from watchlist"""
    result = await db.watchlist.delete_one({"user_id": user_id, "anime_id": anime_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    return {"message": "Removed from watchlist"}

@api_router.get("/user/{user_id}/watchlist/{anime_id}/check")
async def check_watchlist(user_id: str, anime_id: str):
    """Check if anime is in watchlist"""
    existing = await db.watchlist.find_one({"user_id": user_id, "anime_id": anime_id})
    return {"in_watchlist": existing is not None}

# ============== FAVORITES ROUTES ==============

@api_router.get("/user/{user_id}/favorites")
async def get_favorites(user_id: str):
    """Get user's favorites"""
    favorites = await db.favorites.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    anime_ids = [item["anime_id"] for item in favorites]
    anime_list = await db.anime.find({"id": {"$in": anime_ids}}, {"_id": 0}).to_list(100)
    
    return anime_list

@api_router.post("/user/{user_id}/favorites/{anime_id}")
async def add_to_favorites(user_id: str, anime_id: str):
    """Add anime to favorites"""
    existing = await db.favorites.find_one({"user_id": user_id, "anime_id": anime_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already in favorites")
    
    item = Favorite(user_id=user_id, anime_id=anime_id)
    doc = item.model_dump()
    doc['added_at'] = doc['added_at'].isoformat()
    await db.favorites.insert_one(doc)
    return {"message": "Added to favorites"}

@api_router.delete("/user/{user_id}/favorites/{anime_id}")
async def remove_from_favorites(user_id: str, anime_id: str):
    """Remove anime from favorites"""
    result = await db.favorites.delete_one({"user_id": user_id, "anime_id": anime_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in favorites")
    return {"message": "Removed from favorites"}

@api_router.get("/user/{user_id}/favorites/{anime_id}/check")
async def check_favorites(user_id: str, anime_id: str):
    """Check if anime is in favorites"""
    existing = await db.favorites.find_one({"user_id": user_id, "anime_id": anime_id})
    return {"in_favorites": existing is not None}

# ============== WATCH HISTORY ROUTES ==============

@api_router.get("/user/{user_id}/history")
async def get_watch_history(user_id: str):
    """Get user's watch history"""
    history = await db.history.find({"user_id": user_id}, {"_id": 0}).sort("watched_at", -1).to_list(50)
    
    anime_ids = list(set([item["anime_id"] for item in history]))
    anime_list = await db.anime.find({"id": {"$in": anime_ids}}, {"_id": 0}).to_list(100)
    anime_map = {a["id"]: a for a in anime_list}
    
    result = []
    for item in history:
        anime = anime_map.get(item["anime_id"])
        if anime:
            result.append({
                **item,
                "anime": anime
            })
    
    return result

@api_router.post("/user/{user_id}/history")
async def update_watch_history(user_id: str, anime_id: str, episode_number: int, progress: float = 0):
    """Update watch history"""
    existing = await db.history.find_one({
        "user_id": user_id,
        "anime_id": anime_id,
        "episode_number": episode_number
    })
    
    if existing:
        await db.history.update_one(
            {"id": existing["id"]},
            {"$set": {
                "progress": progress,
                "watched_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        item = WatchHistory(
            user_id=user_id,
            anime_id=anime_id,
            episode_number=episode_number,
            progress=progress
        )
        doc = item.model_dump()
        doc['watched_at'] = doc['watched_at'].isoformat()
        await db.history.insert_one(doc)
    
    return {"message": "History updated"}

# ============== JIKAN API INTEGRATION ==============

@api_router.get("/jikan/search")
async def search_jikan(q: str, page: int = 1):
    """Search anime from Jikan API (MyAnimeList)"""
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(
            f"https://api.jikan.moe/v4/anime",
            params={"q": q, "page": page, "limit": 20}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch from Jikan API")
        return response.json()

@api_router.post("/jikan/import/{mal_id}")
async def import_from_jikan(mal_id: int):
    """Import anime from Jikan API to database"""
    # Check if already imported
    existing = await db.anime.find_one({"mal_id": mal_id})
    if existing:
        raise HTTPException(status_code=400, detail="Anime already imported")
    
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"https://api.jikan.moe/v4/anime/{mal_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Anime not found on MAL")
        
        data = response.json()["data"]
        
        anime = Anime(
            mal_id=mal_id,
            title=data["title"],
            title_japanese=data.get("title_japanese"),
            synopsis=data.get("synopsis"),
            cover_image=data["images"]["jpg"].get("large_image_url"),
            banner_image=data["images"]["jpg"].get("large_image_url"),
            genres=[g["name"] for g in data.get("genres", [])],
            status="ongoing" if data.get("airing") else "completed",
            rating=data.get("score"),
            year=data.get("year"),
            total_episodes=data.get("episodes"),
            source="jikan"
        )
        
        doc = anime.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.anime.insert_one(doc)
        
        return {"id": anime.id, "message": "Anime imported successfully"}

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample anime data"""
    # Check if already seeded
    count = await db.anime.count_documents({})
    if count > 0:
        return {"message": "Database already seeded"}
    
    sample_anime = [
        {
            "id": str(uuid.uuid4()),
            "title": "Attack on Titan",
            "title_japanese": "進撃の巨人",
            "synopsis": "Humanity lives inside cities surrounded by enormous walls due to the Titans, gigantic humanoid creatures who devour humans seemingly without reason.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1613487971624-24f87ffdbfc5?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Action", "Drama", "Fantasy", "Mystery"],
            "status": "completed",
            "rating": 9.0,
            "year": 2013,
            "total_episodes": 87,
            "is_featured": True,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "To You, 2,000 Years in the Future", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "24:00"},
                {"number": 2, "title": "That Day", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", "duration": "24:00"},
                {"number": 3, "title": "A Dim Light in the Darkness of Despair", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "duration": "24:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Demon Slayer",
            "title_japanese": "鬼滅の刃",
            "synopsis": "A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/1286/99889l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1572291244855-44aa55da2137?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Action", "Fantasy", "Supernatural"],
            "status": "ongoing",
            "rating": 8.9,
            "year": 2019,
            "total_episodes": 44,
            "is_featured": True,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "Cruelty", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "24:00"},
                {"number": 2, "title": "Trainer Sakonji Urokodaki", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", "duration": "24:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Jujutsu Kaisen",
            "title_japanese": "呪術廻戦",
            "synopsis": "A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman school to be able to locate the demon's other body parts and thus exorcise himself.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/1171/109222l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1656857221015-ddc2163a08da?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Action", "Fantasy", "School", "Supernatural"],
            "status": "ongoing",
            "rating": 8.7,
            "year": 2020,
            "total_episodes": 47,
            "is_featured": True,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "Ryomen Sukuna", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "24:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "My Hero Academia",
            "title_japanese": "僕のヒーローアカデミア",
            "synopsis": "In a world where most of the population has superpowers, a powerless boy dreams of becoming a hero.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/10/78745l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1610114586897-20495783e96c?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Action", "Comedy", "School", "Superhero"],
            "status": "ongoing",
            "rating": 8.4,
            "year": 2016,
            "total_episodes": 138,
            "is_featured": False,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "Izuku Midoriya: Origin", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "24:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "One Punch Man",
            "title_japanese": "ワンパンマン",
            "synopsis": "The story of Saitama, a hero who can defeat any opponent with a single punch but seeks to find a worthy opponent.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/12/76049l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1703305776558-e5568941ae7a?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Action", "Comedy", "Parody", "Superhero"],
            "status": "ongoing",
            "rating": 8.5,
            "year": 2015,
            "total_episodes": 24,
            "is_featured": False,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "The Strongest Man", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "24:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Death Note",
            "title_japanese": "デスノート",
            "synopsis": "A high school student discovers a supernatural notebook that allows him to kill anyone by writing the victim's name while picturing their face.",
            "cover_image": "https://cdn.myanimelist.net/images/anime/9/9453l.jpg",
            "banner_image": "https://images.unsplash.com/photo-1613487971624-24f87ffdbfc5?q=80&w=1920&auto=format&fit=crop",
            "genres": ["Mystery", "Psychological", "Supernatural", "Thriller"],
            "status": "completed",
            "rating": 9.0,
            "year": 2006,
            "total_episodes": 37,
            "is_featured": False,
            "source": "manual",
            "episodes": [
                {"number": 1, "title": "Rebirth", "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "duration": "23:00"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.anime.insert_many(sample_anime)
    return {"message": f"Seeded {len(sample_anime)} anime"}

@api_router.get("/")
async def root():
    return {"message": "AniStream API v1.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

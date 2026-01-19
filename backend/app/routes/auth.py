from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
import httpx
import os
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

from ..db import get_db
from ..models import User, Trip
from ..schemas import UserCreate, AuthResponse, UserResponse
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

TRIP_DISTANCE_THRESHOLD_KM = 1.0

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371
    return c * r

async def process_location_change(
    user: User,
    lat: float | None,
    lng: float | None,
    db: AsyncSession
) -> None:
    """Process location change and create/close trips as necessary."""
    if lat is None or lng is None:
        return

    result = await db.execute(
        select(Trip)
        .where(Trip.user_id == user.id)
        .order_by(desc(Trip.start_time))
        .limit(1)
    )
    last_trip = result.scalar_one_or_none()

    if not last_trip or last_trip.start_location_lat is None or last_trip.start_location_lng is None:
        new_trip = Trip(
            user_id=user.id,
            start_location_lat=lat,
            start_location_lng=lng,
            start_time=datetime.utcnow()
        )
        db.add(new_trip)
        print(f"DEBUG: Created first trip for user {user.id} at ({lat}, {lng})")
        return

    distance_km = haversine(
        last_trip.start_location_lat,
        last_trip.start_location_lng,
        lat,
        lng
    )

    if distance_km > TRIP_DISTANCE_THRESHOLD_KM:
        if last_trip.end_time is None:
            last_trip.end_location_lat = lat
            last_trip.end_location_lng = lng
            last_trip.end_time = datetime.utcnow()
            last_trip.distance_km = distance_km

        new_trip = Trip(
            user_id=user.id,
            start_location_lat=lat,
            start_location_lng=lng,
            start_time=datetime.utcnow()
        )
        db.add(new_trip)
        print(f"DEBUG: Distance {distance_km:.2f}km - Created new trip")
    else:
        print(f"DEBUG: Distance {distance_km:.2f}km - Same location, no new trip")

class GoogleTokenRequest(BaseModel):
    id_token: str
    lat: float | None = None
    lng: float | None = None

@router.post("/signup", response_model=AuthResponse)
async def signup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return {"token": token}

@router.post("/login", response_model=AuthResponse)
async def login(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await process_location_change(user, user_data.lat, user_data.lng, db)
    await db.commit()

    token = create_access_token({"sub": user.id})
    return {"token": token}

@router.post("/google", response_model=AuthResponse)
async def google_login(request: GoogleTokenRequest, db: AsyncSession = Depends(get_db)):
    """Login with Google OAuth."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={request.id_token}"
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            
            token_info = response.json()
            
            if token_info.get("aud") != GOOGLE_CLIENT_ID:
                raise HTTPException(status_code=401, detail="Token not issued for this app")
            
            google_id = token_info.get("sub")
            email = token_info.get("email")
            
            if not email:
                raise HTTPException(status_code=400, detail="Email not provided by Google")
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Failed to verify Google token")
    
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    
    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            user.google_id = google_id
        else:
            user = User(
                email=email,
                google_id=google_id,
                password_hash=None,
            )
            db.add(user)
        
        await db.commit()
        await db.refresh(user)
    
    await process_location_change(user, request.lat, request.lng, db)
    await db.commit()
    
    token = create_access_token({"sub": user.id})
    return {"token": token}

@router.post("/terms/accept")
async def accept_terms(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Accept Terms of Service."""
    from datetime import datetime
    current_user.tos_accepted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(current_user)
    return {"status": "success", "tos_accepted_at": current_user.tos_accepted_at}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "tos_accepted_at": current_user.tos_accepted_at
    }

me_router = APIRouter(tags=["auth"])

@me_router.get("/me", response_model=UserResponse)
async def get_me_root(current_user: User = Depends(get_current_user)):
    """Get current user info (root level)."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "tos_accepted_at": current_user.tos_accepted_at
    }

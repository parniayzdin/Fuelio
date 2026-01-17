from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Trip
from ..schemas import TripGuessResponse
from ..auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/trip-guess", response_model=TripGuessResponse)
async def get_trip_guess(
    region_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Predict probability and distance of trip in next 24 hours.
    
    Heuristic:
    - Look at last 14 days of trips
    - Find trips on same weekday as tomorrow
    - Probability = clipped [0.1, 0.9] based on count
    - Expected distance = average of those trips, else 15 km
    """
    tomorrow = datetime.now() + timedelta(days=1)
    target_weekday = tomorrow.weekday()
    two_weeks_ago = datetime.now() - timedelta(days=14)

    # Get trips from last 14 days
    result = await db.execute(
        select(Trip)
        .where(Trip.user_id == current_user.id, Trip.start_time >= two_weeks_ago)
    )
    recent_trips = result.scalars().all()

    # Filter to same weekday
    weekday_trips = [
        t for t in recent_trips
        if t.start_time.weekday() == target_weekday
    ]

    # Calculate probability based on trip count
    # 0 trips = 0.1, 1 trip = 0.4, 2+ trips = 0.7-0.9
    if len(weekday_trips) == 0:
        probability = 0.1
    elif len(weekday_trips) == 1:
        probability = 0.4
    else:
        probability = min(0.9, 0.5 + 0.2 * len(weekday_trips))

    # Calculate expected distance
    if weekday_trips:
        expected_distance = sum(t.distance_km for t in weekday_trips) / len(weekday_trips)
    else:
        expected_distance = 15.0

    return TripGuessResponse(
        probability_trip_next_24h=round(probability, 2),
        expected_trip_distance_km=round(expected_distance, 1),
    )

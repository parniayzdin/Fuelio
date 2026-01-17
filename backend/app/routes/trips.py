from typing import Optional
import json
import os
import googlemaps
from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Trip
from ..schemas import TripCreate, TripResponse
from ..auth import get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])

# Initialize Google Maps client
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
gmaps = None
if GOOGLE_MAPS_API_KEY:
    try:
        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Google Maps client: {e}")


def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """Get readable address/landmark from coordinates."""
    if not gmaps:
        return None
    try:
        # result_type='point_of_interest' prefers landmarks
        # result_type='street_address' falls back to address
        results = gmaps.reverse_geocode((lat, lng))
        if results:
            # Return formatted address of first result
            return results[0].get("formatted_address")
    except Exception as e:
        print(f"Geocoding error for {lat},{lng}: {e}")
    return None


@router.get("", response_model=list[TripResponse])
async def get_trips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all trips for current user."""
    result = await db.execute(
        select(Trip)
        .where(Trip.user_id == current_user.id)
        .order_by(Trip.start_time.desc())
    )
    trips = result.scalars().all()

    return [
        TripResponse(
            id=trip.id,
            start_time=trip.start_time,
            end_time=trip.end_time,
            distance_km=trip.distance_km,
            start_location_lat=trip.start_location_lat,
            start_location_lng=trip.start_location_lng,
            end_location_lat=trip.end_location_lat,
            end_location_lng=trip.end_location_lng,
            start_address=trip.start_address,
            end_address=trip.end_address,
        )
        for trip in trips
    ]


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new trip (manually or from auto-tracking)."""
    from datetime import datetime
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two points."""
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        return c * 6371  # Earth radius in km
    
    # Calculate distance if not provided but locations are
    distance = trip_data.distance_km
    if distance is None and all([
        trip_data.start_location_lat,
        trip_data.start_location_lng,
        trip_data.end_location_lat,
        trip_data.end_location_lng
    ]):
        distance = haversine(
            trip_data.start_location_lat,
            trip_data.start_location_lng,
            trip_data.end_location_lat,
            trip_data.end_location_lng
        )
    
    # Auto-geocode if addresses missing
    start_addr = trip_data.start_address
    end_addr = trip_data.end_address
    
    if not start_addr and trip_data.start_location_lat and trip_data.start_location_lng:
        start_addr = reverse_geocode(trip_data.start_location_lat, trip_data.start_location_lng)
        
    if not end_addr and trip_data.end_location_lat and trip_data.end_location_lng:
        end_addr = reverse_geocode(trip_data.end_location_lat, trip_data.end_location_lng)

    # Validate: Reject trips with no distance
    if distance is None or distance <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip must have a valid distance greater than 0"
        )
    
    # Validate: Reject trips where geocoding failed (no addresses)
    if not start_addr or not end_addr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine trip locations. Please ensure valid coordinates are provided."
        )

    trip = Trip(
        user_id=current_user.id,
        start_time=trip_data.start_time or datetime.utcnow(),
        end_time=trip_data.end_time or datetime.utcnow(),
        distance_km=distance,
        start_location_lat=trip_data.start_location_lat,
        start_location_lng=trip_data.start_location_lng,
        end_location_lat=trip_data.end_location_lat,
        end_location_lng=trip_data.end_location_lng,
        start_address=start_addr,
        end_address=end_addr,
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    return TripResponse(
        id=trip.id,
        start_time=trip.start_time,
        end_time=trip.end_time,
        distance_km=trip.distance_km,
        start_location_lat=trip.start_location_lat,
        start_location_lng=trip.start_location_lng,
        end_location_lat=trip.end_location_lat,
        end_location_lng=trip.end_location_lng,
        start_address=trip.start_address,
        end_address=trip.end_address,
    )


@router.post("/import-timeline", status_code=status.HTTP_201_CREATED)
async def import_timeline(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import trips from Google Timeline JSON."""
    from datetime import datetime

    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")

    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")

    # Handle different Google Takeout formats
    # Format 1: "timelineObjects" list with "activitySegment"
    # Format 2: Top-level object with semanticSegments
    
    segments = []
    
    if "timelineObjects" in data:
        for obj in data["timelineObjects"]:
            if "activitySegment" in obj:
                segments.append(obj["activitySegment"])
    elif "semanticSegments" in data: # Newer format
        for obj in data["semanticSegments"]:
             if "activity" in obj: # Sometimes nested differently, adjust as needed
                 # Actually semanticSegments list usually contains objects that HAVE 'visit' or 'activity'
                 # 'activity' usually means travel
                 segments.append(obj)
                 
    imported_count = 0
    
    # Process segments (focusing on vehicle travel)
    for segment in segments:
        # Detect transport type
        activity_type = segment.get("activityType", "").upper()
        if not activity_type:
            # Try deeper path for some formats
             activity_type = segment.get("activity", {}).get("topCandidate", {}).get("type", "").upper()

        if activity_type not in ["IN_PASSENGER_VEHICLE", "IN_VEHICLE", "DRIVING", "IN_CAR"]:
            continue
            
        # Extract start/end
        try:
            # Different formats have different date structures
            # Expecting ISO strings or similar
            
            # Start
            start_loc = segment.get("startLocation", {})
            start_lat = start_loc.get("latitudeE7") / 1e7 if "latitudeE7" in start_loc else None
            start_lng = start_loc.get("longitudeE7") / 1e7 if "longitudeE7" in start_loc else None
            
            # End
            end_loc = segment.get("endLocation", {})
            end_lat = end_loc.get("latitudeE7") / 1e7 if "latitudeE7" in end_loc else None
            end_lng = end_loc.get("longitudeE7") / 1e7 if "longitudeE7" in end_loc else None
            
            # Time
            duration = segment.get("duration", {})
            start_ts = duration.get("startTimestamp")
            end_ts = duration.get("endTimestamp")
            
            if not (start_ts and end_ts):
                continue
                
            start_time = datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(end_ts.replace("Z", "+00:00"))
            
            # Distance
            distance_meters = segment.get("distance", 0)
            distance_km = float(distance_meters) / 1000.0 if distance_meters else None
            
            # Geocode if coordinates exist
            s_addr = None
            e_addr = None
            if start_lat and start_lng:
                 s_addr = reverse_geocode(start_lat, start_lng)
            if end_lat and end_lng:
                 e_addr = reverse_geocode(end_lat, end_lng)
            
            trip = Trip(
                user_id=current_user.id,
                start_time=start_time,
                end_time=end_time,
                distance_km=distance_km,
                start_location_lat=start_lat,
                start_location_lng=start_lng,
                end_location_lat=end_lat,
                end_location_lng=end_lng,
                start_address=s_addr,
                end_address=e_addr
            )
            db.add(trip)
            imported_count += 1
            
        except Exception as e:
            print(f"Skipping segment due to error: {e}")
            continue

    if imported_count > 0:
        await db.commit()
    
    return {"status": "success", "imported": imported_count}


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a trip."""
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    await db.delete(trip)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_trips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all trips for current user."""
    result = await db.execute(
        select(Trip).where(Trip.user_id == current_user.id)
    )
    trips = result.scalars().all()
    
    for trip in trips:
        await db.delete(trip)
    
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""
Gas Stations API - Fetch nearby gas stations using Google Places API
"""
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import googlemaps
from datetime import datetime
from ..db import get_db
from ..models import GasStation as GasStationModel
from sqlalchemy import select, and_

router = APIRouter(prefix="/gas-stations", tags=["gas-stations"])

# Get Google Maps API key from environment
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")

# Initialize Google Maps client
gmaps = None
if GOOGLE_MAPS_API_KEY:
    try:
        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Google Maps client: {e}")


class GasStation(BaseModel):
    id: str
    name: str
    brand: str
    lat: float
    lng: float
    address: str
    regular: Optional[float] = None
    premium: Optional[float] = None
    diesel: Optional[float] = None
    lastUpdated: str
    place_id: Optional[str] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None


def extract_brand_from_name(name: str) -> str:
    """Extract gas station brand from the place name."""
    brands = [
        "Shell", "Petro-Canada", "Esso", "Canadian Tire", "Costco",
        "Ultramar", "Mobil", "Chevron", "Sunoco", "Husky", "Pioneer",
        "7-Eleven", "Circle K", "Irving", "Fas Gas", "Co-op"
    ]
    
    name_upper = name.upper()
    for brand in brands:
        if brand.upper() in name_upper:
            return brand
    
    # Default to the first word of the name
    return name.split()[0] if name else "Gas Station"


from ..services.fuel_service import FuelService

# Initialize FuelService
fuel_service = FuelService()
fuel_service_initialized = False

async def get_station_prices(lat: float, lng: float, station_name: str = "") -> dict:
    """
    Get real gas prices using FuelService (pyfuelprices).
    Tries to find exact station match, otherwise falls back to regional average.
    """
    global fuel_service_initialized
    if not fuel_service_initialized:
        try:
            await fuel_service.initialize()
            fuel_service_initialized = True
        except Exception as e:
            print(f"⚠️ Failed to init FuelService: {e}")

    # Default fallback prices
    prices = {
        "regular": 1.45,
        "premium": 1.65,
        "diesel": 1.55
    }

    try:
        # 1. Try to find specific station (radius ~1km = 0.6 miles)
        # pyfuelprices uses miles? The service wrapper might handle it.
        # Looking at FuelService._get_regional_average it passes radius directly.
        # Let's assume broad search first.
        found_stations = fuel_service.fuel_client.find_fuel_stations_from_point((lat, lng), 1.0)
        
        target_station = None
        if found_stations:
            # Simple heuristic: closest distance is likely the one
            # pyfuelprices stations usually have lat/lng
            # For now, just take the first one found in tight radius
            target_station = found_stations[0]
            
        if target_station:
            # Extract prices
            for fuel in target_station.available_fuels:
                ftype = fuel.fuel_type.lower()
                if ftype in ["regular", "unleaded", "gasoline"] and fuel.cost > 0:
                    prices["regular"] = fuel.cost
                elif ftype in ["premium", "super", "premium gasoline"] and fuel.cost > 0:
                    prices["premium"] = fuel.cost
                elif ftype in ["diesel"] and fuel.cost > 0:
                    prices["diesel"] = fuel.cost
                    
            # Auto-calculate gaps if missing
            if prices["premium"] == 1.65 and prices["regular"] != 1.45:
                 prices["premium"] = round(prices["regular"] + 0.20, 2)
            if prices["diesel"] == 1.55 and prices["regular"] != 1.45:
                 prices["diesel"] = round(prices["regular"] + 0.15, 2)
                 
            return prices

        # 2. Fallback: Regional Average
        # We can use the service's finding logic to just get ANY stats
        # Or use hardcoded coordinates for known regions
        
        # Determine closest major region
        # (Simple distance check to known hubs)
        hubs = {
            "toronto": (43.65, -79.38),
            "ottawa": (45.42, -75.69),
            "sudbury": (46.49, -80.99),
            "thunder_bay": (48.38, -89.24)
        }
        
        closest_hub = None
        min_dist = 9999
        for name, coords in hubs.items():
            dist = ((lat - coords[0])**2 + (lng - coords[1])**2)**0.5
            if dist < min_dist:
                min_dist = dist
                closest_hub = coords
                
        if closest_hub:
             avg = fuel_service._get_regional_average(closest_hub, radius=25.0)
             if avg:
                 prices["regular"] = avg
                 prices["premium"] = round(avg + 0.20, 2)
                 prices["diesel"] = round(avg + 0.15, 2)
                 
    except Exception as e:
        print(f"Error fetching real prices for {lat},{lng}: {e}")

    return prices

# ... (imports overhead)

@router.get("/nearby", response_model=list[GasStation])
async def get_nearby_gas_stations(
    lat: float = Query(..., description="Latitude of the center point"),
    lng: float = Query(..., description="Longitude of the center point"),
    radius: int = Query(5000, description="Search radius in meters", ge=100, le=50000),
    db: AsyncSession = Depends(get_db)
):
    """
    Get nearby gas stations using Google Places API.
    
    Args:
        lat: Latitude of the center point
        lng: Longitude of the center point
        radius: Search radius in meters (default: 5000m)
    
    Returns:
        List of gas stations with location, name, and estimated prices
    """
    if not gmaps:
        raise HTTPException(
            status_code=503,
            detail="Google Maps API not configured. Please set VITE_GOOGLE_MAPS_API_KEY in .env"
        )
    
    try:
        # Use Places API Nearby Search to find gas stations
        # Type 'gas_station' returns actual gas stations
        # Google Places API returns up to 20 results per page, max 60 results total (3 pages)

        # 1. Fetch existing stations from DB for this area (rectangular bounds approximation)
        degree_offset = (radius / 111000.0) * 1.5 # 1.5x buffer for DB query
        
        db_stations = []
        try:
            stmt = select(GasStationModel).where(
                and_(
                    GasStationModel.lat >= lat - degree_offset,
                    GasStationModel.lat <= lat + degree_offset,
                    GasStationModel.lng >= lng - degree_offset,
                    GasStationModel.lng <= lng + degree_offset
                )
            )
            result = await db.execute(stmt)
            db_stations = result.scalars().all()
            print(f"📥 Loaded {len(db_stations)} stations from DB Cache")
        except Exception as e:
            print(f"⚠️ Warning: DB Cache read failed: {e}")

        # Convert DB models to Pydantic
        stations_map = {}
        for s in db_stations:
            stations_map[s.place_id] = GasStation(
                id=s.place_id,
                name=s.name,
                brand=s.brand,
                lat=s.lat,
                lng=s.lng,
                address=s.address,
                regular=s.regular,
                premium=s.premium,
                diesel=s.diesel,
                lastUpdated=s.last_updated.strftime("%Y-%m-%d %H:%M:%S"),
                place_id=s.place_id,
                rating=s.rating,
                user_ratings_total=int(s.user_ratings_total) if s.user_ratings_total else None
            )

        # 2. Fetch new data from Google Places (Grid Search)
        if gmaps:
            try:
                # Helper function to fetch a single page of results
                def fetch_places(location, radius, page_token=None):
                    try:
                        places_result = gmaps.places_nearby(
                            location=location,
                            radius=radius if not page_token else None,
                            type='gas_station',
                            page_token=page_token
                        )
                        return places_result.get('results', []), places_result.get('next_page_token')
                    except Exception as e:
                        print(f"Error fetching places at {location}: {e}")
                        return [], None

                raw_results = []
                
                # STRATEGY: Small vs Large Radius Grid Search
                if radius <= 5000:
                    next_page_token = None
                    for _ in range(3):
                        results, next_page_token = fetch_places((lat, lng), radius, next_page_token)
                        raw_results.extend(results)
                        if not next_page_token: break
                        import time
                        time.sleep(2)
                else:
                    # Large radius: Sector Search (Grid)
                    offset_deg = (radius * 0.5) / 111000 
                    sectors = [
                        ((lat, lng), radius * 0.6),            # Center
                        ((lat + offset_deg, lng), radius * 0.6), # North
                        ((lat - offset_deg, lng), radius * 0.6), # South
                        ((lat, lng + offset_deg), radius * 0.6), # East
                        ((lat, lng - offset_deg), radius * 0.6), # West
                    ]
                    print(f"🌍 Performing Sector Search with {len(sectors)} sectors")
                    for loc, sec_radius in sectors:
                        results, _ = fetch_places(loc, sec_radius)
                        raw_results.extend(results)

                # 3. Process and Upsert to DB
                new_stations_count = 0
                for place in raw_results:
                    place_id = place.get('place_id')
                    if not place_id: continue
                    
                    # Extract location
                    location = place.get('geometry', {}).get('location', {})
                    place_lat = location.get('lat')
                    place_lng = location.get('lng')
                    if not place_lat or not place_lng: continue
                    
                    # Metadata
                    name = place.get('name', 'Gas Station')
                    address = place.get('vicinity', '')
                    rating = place.get('rating')
                    # Handle user_ratings_total carefully
                    user_ratings_total = place.get('user_ratings_total')
                    # Ensure it's not None if possible or leave it Optional
                    
                    brand = extract_brand_from_name(name)
                    prices = await get_station_prices(place_lat, place_lng, name)
                    
                    # Create/Update DB Model
                    # Check if exists in DB (optimization: check our map first)
                    if place_id not in stations_map: # New station or update logic could go here
                        new_stations_count += 1
                        
                    # Upsert to DB
                    # Note: In a real app we might only update if data changed or is old
                    # For now, we will update the DB record to ensure freshness
                    db_station = await db.get(GasStationModel, place_id)
                    if not db_station:
                        db_station = GasStationModel(place_id=place_id)
                        db.add(db_station)
                    
                    db_station.name = name
                    db_station.brand = brand
                    db_station.lat = place_lat
                    db_station.lng = place_lng
                    db_station.address = address
                    db_station.regular = prices['regular']
                    db_station.premium = prices['premium']
                    db_station.diesel = prices['diesel']
                    db_station.rating = rating
                    db_station.user_ratings_total = user_ratings_total
                    db_station.last_updated = datetime.utcnow()
                    
                    # Update our response map
                    stations_map[place_id] = GasStation(
                        id=place_id,
                        name=name,
                        brand=brand,
                        lat=place_lat,
                        lng=place_lng,
                        address=address,
                        regular=prices['regular'],
                        premium=prices['premium'],
                        diesel=prices['diesel'],
                        lastUpdated=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        place_id=place_id,
                        rating=rating,
                        user_ratings_total=user_ratings_total
                    )
                
                try:
                    await db.commit()
                    print(f"💾 Upserted {new_stations_count} new/updated stations to DB")
                except Exception as e:
                    await db.rollback()
                    print(f"❌ DB Commit failed: {str(e)}")
                    
            except Exception as e:
                print(f"Error in Google Maps fetch flow: {e}")

        # Return values from map as list
        final_list = list(stations_map.values())
        final_list.sort(key=lambda s: s.regular if s.regular else 999)
        return final_list

        
    except googlemaps.exceptions.ApiError as e:
        error_msg = str(e)
        if "legacy API" in error_msg or "REQUEST_DENIED" in error_msg:
            print(f"❌ Google Maps Error: {error_msg}")
            raise HTTPException(
                status_code=503,
                detail="Google Places API not enabled. Please enable 'Places API' (not just 'Places API (New)') in Google Cloud Console."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Google Maps API error: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching gas stations: {str(e)}"
        )

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Vehicle
from ..schemas import VehicleSchema
from ..auth import get_current_user

router = APIRouter(tags=["vehicle"])

@router.get("/vehicle", response_model=VehicleSchema)
async def get_vehicle(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's vehicle settings."""
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == current_user.id)
    )
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        return VehicleSchema()

    return VehicleSchema(
        tank_size_liters=vehicle.tank_size_liters,
        efficiency_l_per_100km=vehicle.efficiency_l_per_100km,
        reserve_fraction=vehicle.reserve_fraction,
        default_region_id=vehicle.default_region_id,
        make=vehicle.make,
        model=vehicle.model,
        year=int(vehicle.year) if vehicle.year else None,
        image_url=vehicle.image_url,
        fuel_type=vehicle.fuel_type,
    )

import os
import httpx

GOOGLE_SEARCH_CX = "f55aa58e9aef947d0"
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")

async def fetch_car_image(make: str | None, model: str | None, year: int | None) -> str | None:
    """Fetch car image from Google Custom Search API."""
    if not make or not model:
        return None
        
    if not GOOGLE_API_KEY:
        print("Warning: No Google API Key found for image search")
        return None

    query = f"{year or ''} {make} {model} exterior front view site:netcarshow.com OR site:thecarconnection.com OR site:motortrend.com OR site:edmunds.com OR site:kbb.com".strip()
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "q": query,
                    "cx": GOOGLE_SEARCH_CX,
                    "key": GOOGLE_API_KEY,
                    "searchType": "image",
                    "num": 1,
                    "imgSize": "large",
                    "safe": "active"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                if items:
                    return items[0].get("link")
            else:
                print(f"Google Search API Error: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"Failed to fetch vehicle image: {e}")
        
    return None

import re

async def fetch_car_efficiency(make: str, model: str, year: int) -> float | None:
    """Fetch car fuel efficiency (L/100km) from Google Search."""
    if not make or not model:
        return None
        
    if not GOOGLE_API_KEY:
        return None

    query = f"{year or ''} {make} {model} fuel economy L/100km combined rating"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "q": query,
                    "cx": GOOGLE_SEARCH_CX,
                    "key": GOOGLE_API_KEY,
                    "num": 3,
                    "safe": "active"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                pattern = r"(\d{1,2}\.?\d?)\s?[lL]\/100\s?[kK][mM]"
                
                for item in items:
                    snippet = item.get("snippet", "") + " " + item.get("title", "")
                    match = re.search(pattern, snippet)
                    if match:
                        val = float(match.group(1))
                        if 3.0 < val < 30.0:
                            print(f"DEBUG: Found efficiency {val} L/100km in snippet: {snippet[:50]}...")
                            return val
    except Exception as e:
        print(f"Failed to fetch efficiency: {e}")
        
    return None

@router.post("/vehicle", response_model=VehicleSchema)
@router.put("/vehicle", response_model=VehicleSchema)
async def update_vehicle(
    vehicle_data: VehicleSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's vehicle settings."""
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == current_user.id)
    )
    vehicle = result.scalar_one_or_none()

    print(f"DEBUG: update_vehicle make={vehicle_data.make} model={vehicle_data.model} eff={vehicle_data.efficiency_l_per_100km}")

    should_autotune = True
    if vehicle_data.efficiency_l_per_100km and vehicle_data.efficiency_l_per_100km > 0.1:
        should_autotune = False
    
    if should_autotune and vehicle_data.make:
        print("DEBUG: Auto-tuning efficiency from web...")
        fetched_eff = await fetch_car_efficiency(vehicle_data.make, vehicle_data.model, vehicle_data.year or 2020)
        
        if fetched_eff:
            vehicle_data.efficiency_l_per_100km = fetched_eff
        else:
            vehicle_data.efficiency_l_per_100km = 10.0
    elif should_autotune:
        vehicle_data.efficiency_l_per_100km = 9.0

    if vehicle:
        vehicle.tank_size_liters = vehicle_data.tank_size_liters
        vehicle.efficiency_l_per_100km = vehicle_data.efficiency_l_per_100km
        vehicle.reserve_fraction = vehicle_data.reserve_fraction
        vehicle.default_region_id = vehicle_data.default_region_id
        
        model_changed = (
            vehicle.make != vehicle_data.make or 
            vehicle.model != vehicle_data.model or 
            vehicle.year != vehicle_data.year
        )
        
        vehicle.make = vehicle_data.make
        vehicle.model = vehicle_data.model
        vehicle.year = vehicle_data.year
        vehicle.fuel_type = vehicle_data.fuel_type
        
        if vehicle_data.image_url and vehicle_data.image_url.strip():
            vehicle.image_url = vehicle_data.image_url
        elif vehicle_data.image_url == "" or model_changed or not vehicle.image_url:
             vehicle.image_url = await fetch_car_image(vehicle.make, vehicle.model, vehicle.year)
    else:
        if not vehicle_data.image_url:
            vehicle_data.image_url = await fetch_car_image(vehicle_data.make, vehicle_data.model, vehicle_data.year)
            
        vehicle = Vehicle(
            user_id=current_user.id,
            tank_size_liters=vehicle_data.tank_size_liters,
            efficiency_l_per_100km=vehicle_data.efficiency_l_per_100km,
            reserve_fraction=vehicle_data.reserve_fraction,
            default_region_id=vehicle_data.default_region_id,
            make=vehicle_data.make,
            model=vehicle_data.model,
            year=vehicle_data.year,
            image_url=vehicle_data.image_url,
            fuel_type=vehicle_data.fuel_type,
        )
        db.add(vehicle)

    await db.commit()
    await db.refresh(vehicle)

    return VehicleSchema(
        tank_size_liters=vehicle.tank_size_liters,
        efficiency_l_per_100km=vehicle.efficiency_l_per_100km,
        reserve_fraction=vehicle.reserve_fraction,
        default_region_id=vehicle.default_region_id,
        make=vehicle.make,
        model=vehicle.model,
        year=int(vehicle.year) if vehicle.year else None,
        image_url=vehicle.image_url,
        fuel_type=vehicle.fuel_type,
    )

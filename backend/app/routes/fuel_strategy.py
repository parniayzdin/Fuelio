"""
Fuel Strategy API - AI-powered fuel stop optimization
"""
import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from ..db import get_db
from ..models import GasStation as GasStationModel, CreditCard as CreditCardModel
from ..services.fuel_strategy_optimizer import optimize_fuel_strategy

router = APIRouter(prefix="/fuel-strategy", tags=["fuel-strategy"])

class TripPoint(BaseModel):
    """A point along the trip route."""
    lat: float
    lng: float

class FuelStrategyRequest(BaseModel):
    """Request for fuel strategy optimization."""
    trip_path: list[TripPoint]
    departure_date: Optional[str] = None
    tank_size_liters: float = 50.0
    efficiency_l_per_100km: float = 8.0
    current_fuel_percent: float = 30.0
    search_radius_km: float = 20.0

class StationInfo(BaseModel):
    """Gas station information."""
    id: str
    name: str
    brand: str
    address: str
    lat: float
    lng: float

class FillUpStopResponse(BaseModel):
    """A recommended fill-up stop."""
    station: StationInfo
    day_offset: int
    day_name: str
    liters_to_fill: float
    effective_price: float
    base_price: float
    card_to_use: Optional[str]
    km_at_stop: float
    savings_from_card: float
    savings_from_timing: float

class FuelProjectionPoint(BaseModel):
    """Fuel level at a point along the route."""
    km: float
    fuel_pct: float
    action: Optional[str] = None

class FuelStrategyResponse(BaseModel):
    """Response with optimal fuel strategy."""
    stops: list[FillUpStopResponse]
    total_cost: float
    total_savings: float
    reasoning: list[str]
    fuel_projection: list[FuelProjectionPoint]
    solver_status: str
    stations_analyzed: int
    trip_distance_km: float

@router.post("/optimize", response_model=FuelStrategyResponse)
async def optimize_trip_fuel_strategy(
    request: FuelStrategyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize fuel strategy for a trip using Pyomo/CPLEX.
    
    Analyzes:
    - Gas stations within search_radius_km of the trip route
    - 7-day price forecasts
    - User's saved credit card cashback rates
    
    Returns optimal fill-up points with reasoning.
    """
    if len(request.trip_path) < 2:
        raise HTTPException(
            status_code=400,
            detail="Trip path must have at least 2 points (start and end)"
        )
    
    try:
        result = await db.execute(select(GasStationModel))
        db_stations = result.scalars().all()
    except Exception as e:
        print(f"Error fetching stations: {e}")
        db_stations = []
    
    all_stations = []
    for s in db_stations:
        all_stations.append({
            'id': s.place_id,
            'name': s.name,
            'brand': s.brand,
            'lat': s.lat,
            'lng': s.lng,
            'address': s.address,
            'regular': s.regular
        })
    
    try:
        result = await db.execute(select(CreditCardModel))
        db_cards = result.scalars().all()
    except Exception as e:
        print(f"Error fetching cards: {e}")
        db_cards = []
    
    user_cards = []
    for card in db_cards:
        benefits = {}
        if card.benefits_json:
            try:
                benefits = json.loads(card.benefits_json)
            except:
                pass
        user_cards.append({
            'provider': card.provider,
            'cashback': benefits.get('gas_cashback_percent', 0)
        })
    
    route_points = [{'lat': p.lat, 'lng': p.lng} for p in request.trip_path]
    
    from ..services.fuel_strategy_optimizer import haversine_km
    trip_distance = sum(
        haversine_km(
            route_points[i]['lat'], route_points[i]['lng'],
            route_points[i+1]['lat'], route_points[i+1]['lng']
        )
        for i in range(len(route_points) - 1)
    )
    
    result = await optimize_fuel_strategy(
        route_points=route_points,
        all_stations=all_stations,
        user_cards=user_cards,
        tank_size_liters=request.tank_size_liters,
        efficiency_l_per_100km=request.efficiency_l_per_100km,
        current_fuel_percent=request.current_fuel_percent,
        search_radius_km=request.search_radius_km,
        forecast_days=7
    )
    
    from datetime import date, timedelta
    
    stops = []
    for stop in result.stops:
        day_date = date.today() + timedelta(days=stop.day_offset)
        stops.append(FillUpStopResponse(
            station=StationInfo(
                id=stop.station.id,
                name=stop.station.name,
                brand=stop.station.brand,
                address=stop.station.address,
                lat=stop.station.lat,
                lng=stop.station.lng
            ),
            day_offset=stop.day_offset,
            day_name=day_date.strftime("%A, %b %d"),
            liters_to_fill=stop.liters_to_fill,
            effective_price=stop.effective_price,
            base_price=stop.base_price,
            card_to_use=stop.card_to_use,
            km_at_stop=stop.km_at_stop,
            savings_from_card=stop.savings_from_card,
            savings_from_timing=stop.savings_from_timing
        ))
    
    projection = [
        FuelProjectionPoint(km=p['km'], fuel_pct=p['fuel_pct'], action=p.get('action'))
        for p in result.fuel_projection
    ]
    
    return FuelStrategyResponse(
        stops=stops,
        total_cost=result.total_cost,
        total_savings=result.total_savings,
        reasoning=result.reasoning,
        fuel_projection=projection,
        solver_status=result.solver_status,
        stations_analyzed=len(all_stations),
        trip_distance_km=round(trip_distance, 1)
    )

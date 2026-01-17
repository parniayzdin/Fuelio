from datetime import datetime
from typing import Optional, Literal, Union
from pydantic import BaseModel, EmailStr


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class AuthResponse(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: str
    email: str
    tos_accepted_at: Optional[datetime] = None


# Vehicle schemas
class VehicleSchema(BaseModel):
    tank_size_liters: float = 50.0
    efficiency_l_per_100km: float = 8.5
    reserve_fraction: float = 0.1
    default_region_id: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    image_url: Optional[str] = None
    fuel_type: Optional[Literal["regular", "premium", "diesel", "electric"]] = "regular"


# Trip schemas
class TripCreate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    distance_km: Optional[float] = None
    start_location_lat: Optional[float] = None
    start_location_lng: Optional[float] = None
    end_location_lat: Optional[float] = None
    end_location_lng: Optional[float] = None
    start_address: Optional[str] = None
    end_address: Optional[str] = None


class TripResponse(BaseModel):
    id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    distance_km: Optional[float] = None
    start_location_lat: Optional[float] = None
    start_location_lng: Optional[float] = None
    end_location_lat: Optional[float] = None
    end_location_lng: Optional[float] = None
    start_address: Optional[str] = None
    end_address: Optional[str] = None


# Fillup schemas
class FillupCreate(BaseModel):
    time: datetime
    full_tank_bool: bool = True
    fuel_percent_optional: Optional[float] = None
    liters_optional: Optional[float] = None


class FillupResponse(BaseModel):
    id: str
    time: datetime
    full_tank_bool: bool
    fuel_percent_optional: Optional[float] = None
    liters_optional: Optional[float] = None


# Region schemas
class RegionResponse(BaseModel):
    id: str
    name: str


# Price schemas
class PriceResponse(BaseModel):
    day: str
    avg_price_per_liter: float


class ForecastResponse(BaseModel):
    day: str
    predicted_price: float
    delta_from_today: float
    trend: Literal["rising", "flat", "falling"]


# Fuel anchor schemas
class FuelAnchorPercent(BaseModel):
    type: Literal["percent"]
    percent: float


class FuelAnchorDate(BaseModel):
    type: Literal["last_full_fillup_date"]
    date: str


FuelAnchor = Union[FuelAnchorPercent, FuelAnchorDate]


# Decision schemas
class EvaluateRequest(BaseModel):
    region_id: str
    fuel_anchor: dict  # Will be parsed as FuelAnchor
    planned_trip_km: Optional[float] = None
    use_predicted_trip: Optional[bool] = False


class Evidence(BaseModel):
    liters_remaining: Optional[float] = None
    range_km: float
    reserve_fraction: float
    planned_trip_km: Optional[float] = None
    today_price: Optional[float] = None
    predicted_tomorrow: Optional[float] = None
    price_delta: Optional[float] = None
    price_trend: Optional[Literal["rising", "flat", "falling"]] = None


class DecisionResponse(BaseModel):
    decision: Literal["FILL", "NO_ACTION"]
    severity: Literal["low", "medium", "high"]
    confidence: float
    evidence: Evidence
    explanation: str


# AI schemas
class TripGuessResponse(BaseModel):
    probability_trip_next_24h: float
    expected_trip_distance_km: float


# Alert schemas
class AlertResponse(BaseModel):
    id: str
    date: str
    decision: Literal["FILL", "NO_ACTION"]
    severity: Literal["low", "medium", "high"]
    explanation: str
    status: Literal["new", "acknowledged"]

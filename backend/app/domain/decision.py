"""
Decision logic for fuel fill-up recommendations.
Implements the deterministic decision rules as specified.
"""
from dataclasses import dataclass
from typing import Optional, Literal


@dataclass
class VehicleConfig:
    tank_size_liters: float
    efficiency_l_per_100km: float
    reserve_fraction: float


@dataclass
class DecisionInput:
    vehicle: VehicleConfig
    fuel_anchor_type: Literal["percent", "last_full_fillup_date"]
    fuel_percent: Optional[float] = None
    distance_since_fillup_km: Optional[float] = None
    planned_trip_km: Optional[float] = None
    today_price: Optional[float] = None
    predicted_tomorrow: Optional[float] = None


@dataclass
class DecisionResult:
    decision: Literal["FILL", "NO_ACTION"]
    severity: Literal["low", "medium", "high"]
    confidence: float
    liters_remaining: float
    range_km: float
    reserve_fraction: float
    planned_trip_km: Optional[float]
    today_price: Optional[float]
    predicted_tomorrow: Optional[float]
    price_delta: Optional[float]
    price_trend: Optional[Literal["rising", "flat", "falling"]]


def calculate_liters_remaining(
    vehicle: VehicleConfig,
    fuel_anchor_type: str,
    fuel_percent: Optional[float] = None,
    distance_since_fillup_km: Optional[float] = None,
) -> float:
    """Calculate remaining liters based on fuel anchor type."""
    if fuel_anchor_type == "percent" and fuel_percent is not None:
        return vehicle.tank_size_liters * (fuel_percent / 100)
    elif fuel_anchor_type == "last_full_fillup_date" and distance_since_fillup_km is not None:
        liters_used = distance_since_fillup_km * (vehicle.efficiency_l_per_100km / 100)
        return max(0, vehicle.tank_size_liters - liters_used)
    else:
        # Default to 50% if no valid anchor
        return vehicle.tank_size_liters * 0.5


def calculate_range_km(liters_remaining: float, reserve_liters: float, efficiency: float) -> float:
    """Calculate usable range in km."""
    usable_liters = max(0, liters_remaining - reserve_liters)
    return usable_liters / (efficiency / 100)


def calculate_price_trend(
    today_price: Optional[float], predicted_tomorrow: Optional[float]
) -> tuple[Optional[float], Optional[Literal["rising", "flat", "falling"]]]:
    """Calculate price delta and trend."""
    if today_price is None or predicted_tomorrow is None:
        return None, None

    delta = predicted_tomorrow - today_price
    if delta >= 0.02:
        trend = "rising"
    elif delta <= -0.02:
        trend = "falling"
    else:
        trend = "flat"

    return delta, trend


def make_decision(input_data: DecisionInput) -> DecisionResult:
    """
    Make a fuel fill-up decision based on the input data.
    
    Rules (in priority order):
    1. If range_km <= 30 OR liters_remaining <= reserve_liters -> FILL high
    2. If planned_trip_km exists and planned_trip_km > range_km -> FILL high
    3. If planned_trip_km exists and planned_trip_km > 0.7 * range_km -> FILL medium
    4. If trend rising AND range_km < 120 -> FILL medium
    5. Else -> NO_ACTION low
    """
    vehicle = input_data.vehicle
    reserve_liters = vehicle.tank_size_liters * vehicle.reserve_fraction

    # Calculate remaining fuel
    liters_remaining = calculate_liters_remaining(
        vehicle,
        input_data.fuel_anchor_type,
        input_data.fuel_percent,
        input_data.distance_since_fillup_km,
    )

    # Calculate range
    range_km = calculate_range_km(liters_remaining, reserve_liters, vehicle.efficiency_l_per_100km)

    # Calculate price trend
    price_delta, price_trend = calculate_price_trend(
        input_data.today_price, input_data.predicted_tomorrow
    )

    # Apply decision rules
    decision: Literal["FILL", "NO_ACTION"] = "NO_ACTION"
    severity: Literal["low", "medium", "high"] = "low"
    confidence = 0.7

    # Rule 1: Critical low fuel
    if range_km <= 30 or liters_remaining <= reserve_liters:
        decision = "FILL"
        severity = "high"
        confidence = 0.95

    # Rule 2: Planned trip exceeds range
    elif input_data.planned_trip_km and input_data.planned_trip_km > range_km:
        decision = "FILL"
        severity = "high"
        confidence = 0.95

    # Rule 3: Planned trip close to range limit
    elif input_data.planned_trip_km and input_data.planned_trip_km > 0.7 * range_km:
        decision = "FILL"
        severity = "medium"
        confidence = 0.8

    # Rule 4: Prices rising and low range
    elif price_trend == "rising" and range_km < 120:
        decision = "FILL"
        severity = "medium"
        confidence = 0.75

    # Default: No action needed
    else:
        decision = "NO_ACTION"
        severity = "low"
        confidence = 0.7

    return DecisionResult(
        decision=decision,
        severity=severity,
        confidence=confidence,
        liters_remaining=round(liters_remaining, 1),
        range_km=round(range_km, 0),
        reserve_fraction=vehicle.reserve_fraction,
        planned_trip_km=input_data.planned_trip_km,
        today_price=input_data.today_price,
        predicted_tomorrow=input_data.predicted_tomorrow,
        price_delta=round(price_delta, 3) if price_delta else None,
        price_trend=price_trend,
    )

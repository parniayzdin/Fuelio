from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Vehicle, Trip, Fillup, Price, Alert, Notification
from ..schemas import EvaluateRequest, DecisionResponse, Evidence
from ..auth import get_current_user
from ..domain.decision import DecisionInput, VehicleConfig, make_decision
from ..domain.explanation import generate_explanation

router = APIRouter(prefix="/decision", tags=["decision"])


@router.post("/evaluate", response_model=DecisionResponse)
async def evaluate_decision(
    request: EvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate whether to fill up based on current conditions."""
    # Get vehicle config
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == current_user.id)
    )
    vehicle = result.scalar_one_or_none()

    if vehicle:
        vehicle_config = VehicleConfig(
            tank_size_liters=vehicle.tank_size_liters,
            efficiency_l_per_100km=vehicle.efficiency_l_per_100km,
            reserve_fraction=vehicle.reserve_fraction,
        )
    else:
        vehicle_config = VehicleConfig(
            tank_size_liters=50.0,
            efficiency_l_per_100km=8.5,
            reserve_fraction=0.1,
        )

    # Parse fuel anchor
    fuel_anchor = request.fuel_anchor
    fuel_anchor_type = fuel_anchor.get("type", "percent")
    fuel_percent = None
    distance_since_fillup = None

    if fuel_anchor_type == "percent":
        fuel_percent = fuel_anchor.get("percent", 50)
    else:
        # Calculate distance since last full fillup
        fillup_date_str = fuel_anchor.get("date", "")
        try:
            fillup_date = datetime.strptime(fillup_date_str, "%Y-%m-%d")
        except ValueError:
            fillup_date = datetime.now() - timedelta(days=7)

        # Sum trip distances after that date
        result = await db.execute(
            select(Trip)
            .where(Trip.user_id == current_user.id, Trip.start_time >= fillup_date)
        )
        trips = result.scalars().all()
        distance_since_fillup = sum(t.distance_km for t in trips)

    # Get today's price
    today = date.today()
    result = await db.execute(
        select(Price)
        .where(Price.region_id == request.region_id, Price.day == today)
    )
    price_today = result.scalar_one_or_none()
    today_price = price_today.avg_price_per_liter if price_today else None

    # Get last 7 days prices for prediction
    week_ago = today - timedelta(days=7)
    result = await db.execute(
        select(Price)
        .where(
            Price.region_id == request.region_id,
            Price.day >= week_ago,
            Price.day <= today,
        )
        .order_by(Price.day.desc())
    )
    prices = result.scalars().all()
    predicted_tomorrow = (
        sum(p.avg_price_per_liter for p in prices) / len(prices) if prices else None
    )

    # Get planned trip km
    planned_trip_km = request.planned_trip_km

    # If using predicted trip, get the AI guess
    if request.use_predicted_trip and not planned_trip_km:
        # Simple weekday-based prediction
        tomorrow = datetime.now() + timedelta(days=1)
        target_weekday = tomorrow.weekday()
        two_weeks_ago = datetime.now() - timedelta(days=14)

        result = await db.execute(
            select(Trip)
            .where(Trip.user_id == current_user.id, Trip.start_time >= two_weeks_ago)
        )
        recent_trips = result.scalars().all()

        weekday_trips = [
            t for t in recent_trips
            if t.start_time.weekday() == target_weekday
        ]

        if weekday_trips:
            planned_trip_km = sum(t.distance_km for t in weekday_trips) / len(weekday_trips)
        else:
            planned_trip_km = 15  # Default

    # Make decision
    decision_input = DecisionInput(
        vehicle=vehicle_config,
        fuel_anchor_type=fuel_anchor_type,
        fuel_percent=fuel_percent,
        distance_since_fillup_km=distance_since_fillup,
        planned_trip_km=planned_trip_km,
        today_price=today_price,
        predicted_tomorrow=predicted_tomorrow,
    )

    decision_result = make_decision(decision_input)

    # Generate explanation
    explanation = generate_explanation(
        decision=decision_result.decision,
        severity=decision_result.severity,
        range_km=decision_result.range_km,
        liters_remaining=decision_result.liters_remaining,
        planned_trip_km=decision_result.planned_trip_km,
        price_trend=decision_result.price_trend,
        price_delta=decision_result.price_delta,
        today_price=decision_result.today_price,
    )

    # If decision is FILL, create alert and notification
    if decision_result.decision == "FILL":
        alert = Alert(
            user_id=current_user.id,
            decision=decision_result.decision,
            severity=decision_result.severity,
            confidence=decision_result.confidence,
            explanation=explanation,
            status="new",
        )
        db.add(alert)
        await db.flush()

        notification = Notification(
            alert_id=alert.id,
            user_id=current_user.id,
            type="push",
            status="pending",
        )
        db.add(notification)
        await db.commit()

    return DecisionResponse(
        decision=decision_result.decision,
        severity=decision_result.severity,
        confidence=decision_result.confidence,
        evidence=Evidence(
            liters_remaining=decision_result.liters_remaining,
            range_km=decision_result.range_km,
            reserve_fraction=decision_result.reserve_fraction,
            planned_trip_km=decision_result.planned_trip_km,
            today_price=decision_result.today_price,
            predicted_tomorrow=decision_result.predicted_tomorrow,
            price_delta=decision_result.price_delta,
            price_trend=decision_result.price_trend,
        ),
        explanation=explanation,
    )

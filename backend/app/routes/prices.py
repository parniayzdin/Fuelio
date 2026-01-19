from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import Region, Price
from ..schemas import RegionResponse, PriceResponse, ForecastResponse
from ..auth import get_current_user
from ..domain.forecast import generate_forecast

router = APIRouter(prefix="/prices", tags=["prices"])

@router.post("/refresh")
async def refresh_prices(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Trigger update of real fuel prices from external source."""
    from ..services.fuel_service import FuelService
    
    service = FuelService()
    try:
        results = await service.update_all_prices(db)
        return {"status": "success", "updated": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/regions", response_model=list[RegionResponse])
async def get_regions(db: AsyncSession = Depends(get_db)):
    """Get all available regions."""
    result = await db.execute(select(Region).order_by(Region.name))
    regions = result.scalars().all()
    return [RegionResponse(id=r.id, name=r.name) for r in regions]

@router.get("/{region_id}/today", response_model=PriceResponse)
async def get_today_price(
    region_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """Get today's price for a region."""
    today = date.today()

    result = await db.execute(
        select(Price)
        .where(Price.region_id == region_id, Price.day == today)
    )
    price = result.scalar_one_or_none()

    if not price:
        yesterday = today - timedelta(days=1)
        result = await db.execute(
            select(Price)
            .where(Price.region_id == region_id, Price.day == yesterday)
        )
        price = result.scalar_one_or_none()

    if not price:
        raise HTTPException(status_code=404, detail="Price data not found for region")

    return PriceResponse(
        day=price.day.isoformat(),
        avg_price_per_liter=price.avg_price_per_liter,
    )

@router.get("/{region_id}/series", response_model=list[PriceResponse])
async def get_price_series(
    region_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """Get price series for a region."""
    start_date = date.today() - timedelta(days=days)

    result = await db.execute(
        select(Price)
        .where(Price.region_id == region_id, Price.day >= start_date)
        .order_by(Price.day.desc())
    )
    prices = result.scalars().all()

    return [
        PriceResponse(day=p.day.isoformat(), avg_price_per_liter=p.avg_price_per_liter)
        for p in prices
    ]

@router.get("/{region_id}/forecast", response_model=list[ForecastResponse])
async def get_price_forecast(
    region_id: str,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """Get price forecast for a region."""
    today = date.today()
    week_ago = today - timedelta(days=7)

    result = await db.execute(
        select(Price)
        .where(Price.region_id == region_id, Price.day >= week_ago, Price.day <= today)
        .order_by(Price.day.desc())
    )
    prices = result.scalars().all()

    if not prices:
        raise HTTPException(status_code=404, detail="No price data available for forecast")

    today_price = prices[0].avg_price_per_liter
    historical = [p.avg_price_per_liter for p in prices]

    forecasts = generate_forecast(today_price, historical, days)

    return [ForecastResponse(**f) for f in forecasts]

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Fillup
from ..schemas import FillupCreate, FillupResponse
from ..auth import get_current_user

router = APIRouter(prefix="/fillups", tags=["fillups"])

@router.get("", response_model=list[FillupResponse])
async def get_fillups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all fillups for current user."""
    result = await db.execute(
        select(Fillup)
        .where(Fillup.user_id == current_user.id)
        .order_by(Fillup.time.desc())
    )
    fillups = result.scalars().all()

    return [
        FillupResponse(
            id=fillup.id,
            time=fillup.time,
            full_tank_bool=fillup.full_tank_bool,
            fuel_percent_optional=fillup.fuel_percent_optional,
            liters_optional=fillup.liters_optional,
        )
        for fillup in fillups
    ]

@router.post("", response_model=FillupResponse, status_code=status.HTTP_201_CREATED)
async def create_fillup(
    fillup_data: FillupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new fillup record."""
    fillup = Fillup(
        user_id=current_user.id,
        time=fillup_data.time,
        full_tank_bool=fillup_data.full_tank_bool,
        fuel_percent_optional=fillup_data.fuel_percent_optional,
        liters_optional=fillup_data.liters_optional,
    )
    db.add(fillup)
    await db.commit()
    await db.refresh(fillup)

    return FillupResponse(
        id=fillup.id,
        time=fillup.time,
        full_tank_bool=fillup.full_tank_bool,
        fuel_percent_optional=fillup.fuel_percent_optional,
        liters_optional=fillup.liters_optional,
    )

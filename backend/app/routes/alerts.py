from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_db
from ..models import User, Alert
from ..schemas import AlertResponse
from ..auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def get_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all alerts for current user."""
    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc())
        .limit(50)
    )
    alerts = result.scalars().all()

    return [
        AlertResponse(
            id=alert.id,
            date=alert.created_at.isoformat(),
            decision=alert.decision,
            severity=alert.severity,
            explanation=alert.explanation,
            status=alert.status,
        )
        for alert in alerts
    ]

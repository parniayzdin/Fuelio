from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime
import json

from ..db import get_db
from ..models import User, CreditCard
from ..schemas import CreditCardCreate, CreditCardResponse, CreditCardBenefits
from ..auth import get_current_user
from ..services.credit_card_benefits import get_credit_card_benefits, get_supported_providers

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])

@router.get("/providers", response_model=list[str])
async def list_providers():
    """
    Get list of supported credit card providers using Google Generative AI.
    Results are cached after first fetch.
    """
    return await get_supported_providers()

@router.get("", response_model=list[CreditCardResponse])
async def get_credit_cards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all credit cards for the current user.
    """
    result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == current_user.id)
    )
    cards = result.scalars().all()
    
    # Convert to response format
    response_cards = []
    for card in cards:
        benefits = None
        if card.benefits_json:
            try:
                benefits_dict = json.loads(card.benefits_json)
                benefits = CreditCardBenefits(**benefits_dict)
            except (json.JSONDecodeError, TypeError):
                benefits = None
        
        response_cards.append(
            CreditCardResponse(
                id=card.id,
                provider=card.provider,
                benefits=benefits,
                last_updated=card.last_updated,
                created_at=card.created_at
            )
        )
    
    return response_cards

@router.post("", response_model=CreditCardResponse)
async def add_credit_card(
    card_data: CreditCardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a new credit card and fetch its benefits using GCP.
    """
    # Create the card
    new_card = CreditCard(
        user_id=current_user.id,
        provider=card_data.provider,
        benefits_json=None,
        last_updated=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    
    db.add(new_card)
    await db.commit()
    await db.refresh(new_card)
    
    # Fetch benefits asynchronously
    benefits_data = await get_credit_card_benefits(card_data.provider)
    
    # Check if there was an error
    if "error" in benefits_data:
        # Save the card with error info in benefits
        new_card.benefits_json = json.dumps(benefits_data)
        new_card.last_updated = datetime.utcnow()
        await db.commit()
        await db.refresh(new_card)
        
        # Return the card with error in benefits
        benefits = CreditCardBenefits(**{
            "gas_cashback_percent": None,
            "gas_cashback_cap": None,
            "special_promotions": [f"Error: {benefits_data.get('message', 'Unknown error')}"],
            "partner_stations": None,
            "notes": "Failed to fetch benefits. Please refresh after fixing API key."
        })
    else:
        # Save the benefits
        new_card.benefits_json = json.dumps(benefits_data)
        new_card.last_updated = datetime.utcnow()
        await db.commit()
        await db.refresh(new_card)
        
        try:
            benefits = CreditCardBenefits(**benefits_data)
        except (TypeError, ValueError):
            benefits = None
    
    return CreditCardResponse(
        id=new_card.id,
        provider=new_card.provider,
        benefits=benefits,
        last_updated=new_card.last_updated,
        created_at=new_card.created_at
    )

@router.delete("/{card_id}")
async def delete_credit_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a credit card.
    """
    # Check if card exists and belongs to user
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id
        )
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    
    await db.execute(
        delete(CreditCard).where(CreditCard.id == card_id)
    )
    await db.commit()
    
    return {"status": "deleted", "id": card_id}

@router.post("/{card_id}/refresh", response_model=CreditCardResponse)
async def refresh_card_benefits(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh benefits for a specific credit card using GCP.
    """
    # Check if card exists and belongs to user
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id
        )
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    
    # Fetch fresh benefits
    benefits_data = await get_credit_card_benefits(card.provider)
    
    # Update the card
    if "error" in benefits_data:
        card.benefits_json = json.dumps(benefits_data)
        benefits = CreditCardBenefits(**{
            "gas_cashback_percent": None,
            "gas_cashback_cap": None,
            "special_promotions": [f"Error: {benefits_data.get('message', 'Unknown error')}"],
            "partner_stations": None,
            "notes": "Failed to fetch benefits. Please check API key configuration."
        })
    else:
        card.benefits_json = json.dumps(benefits_data)
        try:
            benefits = CreditCardBenefits(**benefits_data)
        except (TypeError, ValueError):
            benefits = None
    
    card.last_updated = datetime.utcnow()
    await db.commit()
    await db.refresh(card)
    
    return CreditCardResponse(
        id=card.id,
        provider=card.provider,
        benefits=benefits,
        last_updated=card.last_updated,
        created_at=card.created_at
    )

"""
Receipt Upload with Google Cloud Vision OCR
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import os
import base64
import re
import httpx

from ..models import User, Fillup
from ..db import get_db
from ..auth import get_current_user

router = APIRouter()


async def extract_receipt_data(image_bytes: bytes) -> dict:
    """Use Google Cloud Vision API to extract text from receipt image."""
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    
    # Encode image to base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Call Cloud Vision API
    url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
    
    request_body = {
        "requests": [{
            "image": {"content": image_base64},
            "features": [{"type": "TEXT_DETECTION"}]
        }]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=request_body)
        result = response.json()
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=f"Vision API error: {result['error']}")
    
    # Extract text
    try:
        full_text = result['responses'][0]['textAnnotations'][0]['description']
    except (KeyError, IndexError):
        return {"price": None, "liters": None, "time": None, "raw_text": ""}
    
    # Parse for price (look for $ followed by numbers)
    price_pattern = r'\$?\s*(\d+\.?\d*)\s*/?\s*L'
    price_match = re.search(price_pattern, full_text, re.IGNORECASE)
    
    # Parse for total amount
    total_pattern = r'(?:total|amount|subtotal)[:\s]*\$?\s*(\d+\.?\d*)'
    total_match = re.search(total_pattern, full_text, re.IGNORECASE)
    
    # Parse for liters
    liters_pattern = r'(\d+\.?\d*)\s*(?:L|liters?|litres?)'
    liters_match = re.search(liters_pattern, full_text, re.IGNORECASE)
    
    # Parse for date/time
    date_pattern = r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
    date_match = re.search(date_pattern, full_text)
    
    time_pattern = r'(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)'
    time_match = re.search(time_pattern, full_text, re.IGNORECASE)
    
    return {
        "price_per_liter": float(price_match.group(1)) if price_match else None,
        "total_amount": float(total_match.group(1)) if total_match else None,
        "liters": float(liters_match.group(1)) if liters_match else None,
        "date": date_match.group(1) if date_match else None,
        "time": time_match.group(1) if time_match else None,
        "raw_text": full_text[:500]  # Return first 500 chars for debugging
    }


@router.post("/fillups/upload-receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a receipt image and extract fillup data using OCR."""
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read image bytes
    image_bytes = await file.read()
    
    # Extract data using Vision API
    extracted = await extract_receipt_data(image_bytes)
    
    # Create fillup record if we extracted useful data
    fillup = None
    if extracted.get("liters") or extracted.get("total_amount"):
        # Determine time
        fillup_time = datetime.utcnow()
        if extracted.get("date"):
            try:
                # Try parsing date
                for fmt in ["%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%m/%d/%y", "%d/%m/%y"]:
                    try:
                        fillup_time = datetime.strptime(extracted["date"], fmt)
                        break
                    except ValueError:
                        continue
            except:
                pass
        
        fillup = Fillup(
            user_id=current_user.id,
            time=fillup_time,
            full_tank=True,
            liters_optional=extracted.get("liters"),
        )
        db.add(fillup)
        await db.commit()
        await db.refresh(fillup)
    
    return {
        "success": True,
        "extracted_data": extracted,
        "fillup_created": fillup is not None,
        "fillup_id": fillup.id if fillup else None
    }


@router.get("/fillups/history")
async def get_fillup_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all fillups for the current user."""
    
    result = await db.execute(
        select(Fillup)
        .where(Fillup.user_id == current_user.id)
        .order_by(Fillup.time.desc())
    )
    fillups = result.scalars().all()
    
    return [
        {
            "id": f.id,
            "time": f.time.isoformat(),
            "full_tank": f.full_tank,
            "liters": f.liters_optional,
            "fuel_percent_after": f.fuel_percent_after_optional
        }
        for f in fillups
    ]

"""
Seed the database with historical price data for all regions.

This script fetches real fuel prices from pyfuelprices and populates
the database with at least 14 days of historical data.
"""
import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

# Add parent directory to path so we can import from backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.app.db import get_db, engine, Base
from backend.app.services.fuel_service import FuelService
from backend.app.models import Price, Region
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def seed_regions(session: AsyncSession):
    """Ensure all regions exist in the database."""
    regions = [
        {"id": "toronto", "name": "Toronto"},
        {"id": "ottawa", "name": "Ottawa"},
        {"id": "hamilton", "name": "Hamilton"},
        {"id": "london", "name": "London"},
        {"id": "kitchener", "name": "Kitchener-Waterloo"},
        {"id": "thunder-bay", "name": "Thunder Bay"},
        {"id": "sudbury", "name": "Sudbury"},
    ]
    
    for region_data in regions:
        result = await session.execute(
            select(Region).where(Region.id == region_data["id"])
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            region = Region(**region_data)
            session.add(region)
            print(f"✓ Added region: {region_data['name']}")
        else:
            print(f"  Region exists: {region_data['name']}")
    
    await session.commit()

async def seed_prices(session: AsyncSession, days: int = 14):
    """Seed price data for the last N days."""
    fuel_service = FuelService()
    
    print(f"\n📊 Fetching real fuel prices from pyfuelprices...")
    try:
        await fuel_service.initialize()
        print("✓ FuelService initialized")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize FuelService: {e}")
        print("   Will generate approximate prices based on regional averages")
        return await seed_fallback_prices(session, days)
    
    today = date.today()
    print(f"\n📅 Seeding prices for {days} days (ending {today})...")
    
    results = await fuel_service.update_all_prices(session)
    
    today_prices = {}
    for region_id, price in results.items():
        if price:
            today_prices[region_id] = price
            print(f"✓ {region_id}: ${price:.3f}/L")
        else:
            print(f"⚠️  {region_id}: No data available")
    
    print(f"\n📈 Generating {days-1} days of historical data...")
    for region_id, today_price in today_prices.items():
        for day_offset in range(1, days):
            past_date = today - timedelta(days=day_offset)
            
            result = await session.execute(
                select(Price).where(
                    Price.region_id == region_id,
                    Price.day == past_date
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                continue
            
            variation = (0.97 + (day_offset * 0.005))
            historical_price = today_price * variation
            
            price_entry = Price(
                region_id=region_id,
                day=past_date,
                avg_price_per_liter=round(historical_price, 3)
            )
            session.add(price_entry)
        
        print(f"✓ Generated {days-1} historical prices for {region_id}")
    
    await session.commit()
    print(f"\n✅ Successfully seeded price data!")

async def seed_fallback_prices(session: AsyncSession, days: int = 14):
    """Fallback method using approximate regional prices."""
    print("\n📊 Using fallback prices based on regional averages...")
    
    regional_prices = {
        "toronto": 1.42,
        "ottawa": 1.45,
        "hamilton": 1.39,
        "london": 1.40,
        "kitchener": 1.38,
        "thunder-bay": 1.52,
        "sudbury": 1.49,
    }
    
    today = date.today()
    
    for region_id, base_price in regional_prices.items():
        for day_offset in range(days):
            past_date = today - timedelta(days=day_offset)
            
            result = await session.execute(
                select(Price).where(
                    Price.region_id == region_id,
                    Price.day == past_date
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                continue
            
            import random
            random.seed(f"{region_id}-{past_date}".encode())
            variation = 1.0 + (random.random() - 0.5) * 0.06
            price = base_price * variation
            
            price_entry = Price(
                region_id=region_id,
                day=past_date,
                avg_price_per_liter=round(price, 3)
            )
            session.add(price_entry)
        
        print(f"✓ Seeded {days} days for {region_id} (avg ${base_price:.2f}/L)")
    
    await session.commit()
    print(f"\n✅ Successfully seeded fallback price data!")

async def main():
    """Main seeding function."""
    print("=" * 60)
    print("   Fuel Up Advisor - Price Data Seeding")
    print("=" * 60)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async for session in get_db():
        try:
            print("\n🌍 Seeding regions...")
            await seed_regions(session)
            
            await seed_prices(session, days=14)
            
            print("\n" + "=" * 60)
            print("   ✅ Seeding completed successfully!")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n❌ Error during seeding: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            await session.close()
            break

if __name__ == "__main__":
    asyncio.run(main())

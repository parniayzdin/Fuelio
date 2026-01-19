"""
Seed script for demo data.
Creates regions, prices, demo user, vehicle, trips, and fillups.
"""
import asyncio
import random
from datetime import datetime, timedelta, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db import async_session, engine, Base
from backend.app.models import User, Vehicle, Trip, Fillup, Region, Price
from backend.app.auth import hash_password

# Demo user credentials
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"

# Canadian regions (Cities)
REGIONS = [
    ("toronto", "Toronto"),
    ("ottawa", "Ottawa"),
    ("hamilton", "Hamilton"),
    ("london", "London"),
    ("kitchener", "Kitchener-Waterloo"),
    ("thunder-bay", "Thunder Bay"),
    ("sudbury", "Sudbury"),
]

# Base prices per region (CAD/liter)
BASE_PRICES = {
    "toronto": 1.42,
    "ottawa": 1.45,
    "hamilton": 1.39,
    "london": 1.40,
    "kitchener": 1.38,
    "thunder-bay": 1.52,
    "sudbury": 1.49,
}

async def seed_regions(db: AsyncSession):
    """Seed regions if they don't exist."""
    for region_id, name in REGIONS:
        result = await db.execute(select(Region).where(Region.id == region_id))
        if not result.scalar_one_or_none():
            region = Region(id=region_id, name=name)
            db.add(region)
    await db.commit()
    print("✓ Regions seeded")

async def seed_prices(db: AsyncSession, days: int = 60):
    """Generate synthetic price data for last N days."""
    today = date.today()

    for region_id, _ in REGIONS:
        base_price = BASE_PRICES[region_id]

        for day_offset in range(days, -1, -1):
            day = today - timedelta(days=day_offset)

            result = await db.execute(
                select(Price).where(Price.region_id == region_id, Price.day == day)
            )
            if result.scalar_one_or_none():
                continue

            variation = random.uniform(-0.05, 0.05)
            if day.weekday() >= 5:
                variation += 0.02

            price_value = round(base_price + variation, 3)

            price = Price(
                region_id=region_id,
                day=day,
                avg_price_per_liter=price_value,
            )
            db.add(price)

    await db.commit()
    print(f"✓ Prices seeded ({days} days for {len(REGIONS)} regions)")

async def seed_demo_user(db: AsyncSession):
    """Create demo user with vehicle, trips, and fillup."""
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        await db.flush()
        print(f"✓ Demo user created: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    else:
        print(f"✓ Demo user exists: {DEMO_EMAIL}")

    result = await db.execute(select(Vehicle).where(Vehicle.user_id == user.id))
    if not result.scalar_one_or_none():
        vehicle = Vehicle(
            user_id=user.id,
            tank_size_liters=55.0,
            efficiency_l_per_100km=8.0,
            reserve_fraction=0.1,
            default_region_id="ontario",
        )
        db.add(vehicle)
        print("✓ Demo vehicle created")

    existing_trips = await db.execute(select(Trip).where(Trip.user_id == user.id))
    if not existing_trips.scalars().first():
        now = datetime.now()
        for days_ago in [1, 2, 4, 5, 7, 8, 9, 11, 12, 14]:
            trip_date = now - timedelta(days=days_ago)
            start_time = trip_date.replace(hour=8, minute=0)
            end_time = trip_date.replace(hour=8, minute=30)
            distance = random.uniform(15, 60)

            trip = Trip(
                user_id=user.id,
                start_time=start_time,
                end_time=end_time,
                distance_km=round(distance, 1),
            )
            db.add(trip)
        print("✓ Demo trips created")

    existing_fillups = await db.execute(select(Fillup).where(Fillup.user_id == user.id))
    if not existing_fillups.scalars().first():
        fillup = Fillup(
            user_id=user.id,
            time=datetime.now() - timedelta(days=5),
            full_tank_bool=True,
            liters_optional=45.0,
        )
        db.add(fillup)
        print("✓ Demo fillup created")

    await db.commit()

async def main():
    print("🌱 Seeding database...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        await seed_regions(db)
        await seed_prices(db)
        await seed_demo_user(db)

    print("✅ Seeding complete!")

if __name__ == "__main__":
    asyncio.run(main())

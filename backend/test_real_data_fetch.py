import asyncio
import logging
from backend.app.services.fuel_service import FuelService
from backend.app.db import async_session

logging.basicConfig(level=logging.INFO)

async def main():
    service = FuelService()
    print("Testing FuelService integration...")
    
    # We won't commit to DB in this test script to avoid messing with session management,
    # or we can just mock the DB part. Actually, let's try to run it fully against the DB.
    async with async_session() as db:
        print("Updating prices...")
        results = await service.update_all_prices(db)
        print("Results:", results)

if __name__ == "__main__":
    asyncio.run(main())

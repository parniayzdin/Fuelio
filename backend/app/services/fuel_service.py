"""
Service for interacting with pyfuelprices and updating local database.
"""
import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pyfuelprices import FuelPrices

from backend.app.models import Price

logger = logging.getLogger(__name__)

REGION_COORDS = {
    "toronto": (43.6532, -79.3832),
    "ottawa": (45.4215, -75.6972),
    "hamilton": (43.2557, -79.8711),
    "london": (42.9849, -81.2453),
    "kitchener": (43.4516, -80.4925),
    "thunder-bay": (48.3809, -89.2477),
    "sudbury": (46.4917, -80.9930),
}

class FuelService:
    def __init__(self):
        self.fuel_client = FuelPrices()

    async def initialize(self):
        """Initialize the pyfuelprices client."""
        logger.info("Initializing FuelService source data...")
        await self.fuel_client.update()
        logger.info("FuelService initialized.")

    async def update_all_prices(self, db: AsyncSession):
        """Fetch and update prices for all configured regions."""
        await self.initialize()

        today = date.today()
        results = {}

        for region_id, coords in REGION_COORDS.items():
            avg_price = self._get_regional_average(coords)
            
            if avg_price:
                await self._save_price(db, region_id, today, avg_price)
                results[region_id] = avg_price
                logger.info(f"Updated {region_id}: ${avg_price:.3f}/L")
            else:
                logger.warning(f"No price data found for {region_id}")
                results[region_id] = None

        await db.commit()
        return results

    def _get_regional_average(self, coords: tuple[float, float], radius: float = 15.0) -> float | None:
        """
        Calculate average regular gas price for a region.
        pyfuelprices stations are returned as dicts with 'available_fuels' dict {type: cost}.
        """
        try:
            stations = self.fuel_client.find_fuel_locations_from_point(coords, radius)
        except Exception as e:
            logger.error(f"Error finding stations at {coords}: {e}")
            return None

        prices = []
        for station in stations:
            available_fuels = station.get("available_fuels", {})
            
            for fuel_type, cost in available_fuels.items():
                if fuel_type.lower() in ["regular", "unleaded", "gasoline"]:
                    if cost > 0:
                        prices.append(cost)
                    break
        
        if not prices:
            return None
            
        return sum(prices) / len(prices)

    async def _save_price(self, db: AsyncSession, region_id: str, day: date, price_val: float):
        """Save or update price entry in DB."""
        stmt = select(Price).where(Price.region_id == region_id, Price.day == day)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.avg_price_per_liter = price_val
        else:
            new_price = Price(
                region_id=region_id,
                day=day,
                avg_price_per_liter=price_val
            )
            db.add(new_price)

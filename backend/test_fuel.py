import asyncio
import logging
from pyfuelprices import FuelPrices

logging.basicConfig(level=logging.DEBUG)

async def main():
    try:
        prices = FuelPrices()
        print("Updating prices...")
        await prices.update()
        
        # Test finding stations near Toronto (approx lat/lon)
        # Lat: 43.65, Lon: -79.38
        stations = prices.find_fuel_stations_from_point((43.65, -79.38), radius=5.0)
        print(f"Found {len(stations)} stations near Toronto")
        
        if stations:
            for station in stations[:3]:
                print(f"Station: {station.name} - {station.brand}")
                for fuel in station.available_fuels:
                    print(f"  {fuel.fuel_type}: {fuel.cost}")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

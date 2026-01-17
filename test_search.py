
import asyncio
import os
from dotenv import load_dotenv
import httpx

# Load env vars from the root .env file
load_dotenv("/Users/karanvirkhanna/fuel-up-advisor/.env")

# Hardcoding for test simplicity as user environment loading can be tricky in scripts
GOOGLE_SEARCH_CX = "f55aa58e9aef947d0"
# Trying to read from env, or fallback to what we expect if possible (but better to rely on env)
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")

async def test_search():
    print(f"DEBUG: API Key present? {'Yes' if GOOGLE_API_KEY else 'No'}")
    if GOOGLE_API_KEY:
        print(f"DEBUG: API Key starts with: {GOOGLE_API_KEY[:4]}...")
    
    print(f"DEBUG: CX: {GOOGLE_SEARCH_CX}")

    if not GOOGLE_API_KEY:
        print("ERROR: No API Key found in environment variables.")
        return

    queries = [
        "2017 Jeep Grand Cherokee fuel consumption L/100km",
        "2020 Honda Civic fuel economy L/100km combined",
        "2023 Ford F-150 fuel consumption L/100km"
    ]

    for query in queries:
        print(f"\n\nDEBUG: Querying for: {query}")
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "q": query,
                        "cx": GOOGLE_SEARCH_CX,
                        "key": GOOGLE_API_KEY,
                        "num": 2, # Get top 2 results
                        "safe": "active"
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    items = data.get("items", [])
                    if items:
                        for i, item in enumerate(items):
                             print(f"--- Result {i+1} ---")
                             print(f"Title: {item.get('title')}")
                             print(f"Snippet: {item.get('snippet')}")
                    else:
                        print("No items found.")
                else:
                    print(f"API Error: {res.text}")
        except Exception as e:
            print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())

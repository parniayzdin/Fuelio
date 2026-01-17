
import os
import requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
print(f"Testing API Key: {key[:5]}...{key[-5:] if key else ''}")

if not key:
    print("❌ No API Key found in .env")
    exit(1)

# Test 1: Geocoding (Raw HTTP, No Referrer) - Simulates Backend
print("\n--- Test 1: Backend Request (No Referrer) ---")
url = f"https://maps.googleapis.com/maps/api/geocode/json?address=Toronto&key={key}"
resp = requests.get(url)
data = resp.json()

if data.get('status') == 'OK':
    print("✅ Success! API is enabled and unrestricted.")
elif data.get('status') == 'REQUEST_DENIED':
    print(f"❌ Failed: {data.get('error_message')}")
else:
    print(f"⚠️ Status: {data.get('status')} - {data.get('error_message')}")

# Test 2: Geocoding (With Referrer) - Simulates Frontend
print("\n--- Test 2: Frontend Request (Simulating 'http://localhost:8080/') ---")
headers = {'Referer': 'http://localhost:8080/'}
resp_ref = requests.get(url, headers=headers)
data_ref = resp_ref.json()

if data_ref.get('status') == 'OK':
    print("✅ Success with Referrer! This means your API key is restricted to 'localhost'.")
    print("👉 SOLUTION: You need to create a separate, unrestricted API key for the backend.")
elif data_ref.get('error_message') == data.get('error_message'):
    print("❌ Failed even with Referrer. This confirms the API is genuinely disabled or billing is off.")
else:
    print(f"⚠️ Status: {data_ref.get('status')} - {data_ref.get('error_message')}")

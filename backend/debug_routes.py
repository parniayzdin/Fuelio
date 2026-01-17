
import sys
import os
from pathlib import Path

# Add parent directory to path so we can import from backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.app.main import app
from fastapi.routing import APIRoute

print("Registered Routes:")
for route in app.routes:
    if isinstance(route, APIRoute):
        print(f"{route.methods} {route.path}")

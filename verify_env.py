
import sys
import os

print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")

try:
    import xmltodict
    print("SUCCESS: xmltodict is installed")
except ImportError:
    print("ERROR: xmltodict is MISSING")
    sys.exit(1)

try:
    # Add current directory to path so we can import backend
    sys.path.append(os.getcwd())
    from backend.app.main import app
    print("SUCCESS: Backend app imported successfully")
except Exception as e:
    print(f"ERROR: Backend import FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

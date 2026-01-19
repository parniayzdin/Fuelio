#!/bin/bash
set -e

echo "Starting Fuel Up Advisor Backend..."

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing Python dependencies..."
pip install -q -r requirements.txt

if [ ! -f "backend/fuelup.db" ]; then
    echo "Seeding database with demo data..."
    python -m backend.seed
fi

echo "Backend starting on http://localhost:8000"
echo "API docs available at http://localhost:8000/docs"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

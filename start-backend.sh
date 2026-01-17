#!/bin/bash

# Backend Start Script
set -e

echo "🐍 Starting Fuel Up Advisor Backend..."

cd "$(dirname "$0")"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -q -r requirements.txt

# Seed database if it doesn't exist
if [ ! -f "backend/fuelup.db" ]; then
    echo "🌱 Seeding database with demo data..."
    python -m backend.seed
fi

# Start the backend server
echo "🚀 Backend starting on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

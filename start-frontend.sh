#!/bin/bash

# Frontend Start Script
set -e

echo "⚛️  Starting Fuel Up Advisor Frontend..."

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Start the frontend dev server
echo "🚀 Frontend starting on http://localhost:8080"
npm run dev

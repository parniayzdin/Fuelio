#!/bin/bash
set -e

echo "Starting Fuel Up Advisor Frontend..."

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

echo "Frontend starting on http://localhost:8080"
npm run dev

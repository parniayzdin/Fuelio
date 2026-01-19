#!/bin/bash

PID=$(lsof -t -i:8000)

if [ -n "$PID" ]; then
  echo "Killing existing process on port 8000 (PID: $PID)..."
  kill -9 $PID
else
  echo "No process found on port 8000."
fi

source venv/bin/activate
export $(grep -v '^#' .env | xargs)

echo "Starting backend..."
nohup uvicorn backend.app.main:app --reload --port 8000 > backend.log 2>&1 &

sleep 2

echo "Backend started successfully."

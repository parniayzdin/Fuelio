#!/bin/bash
echo "Force Killing Fuel-Up Advisor Backend..."

PIDS=$(ps aux | grep -E "uvicorn|backend.app.main" | grep "fuel-up-advisor" | grep -v grep | awk '{print $2}')

if [ -n "$PIDS" ]; then
  echo "Found processes: $PIDS"
  for PID in $PIDS; do
    echo "Killing PID $PID"
    kill -9 $PID
  done
else
  echo "No specific project processes found."
fi

PORT_PID=$(lsof -t -i:8000)
if [ -n "$PORT_PID" ]; then
    echo "Killing process on port 8000: $PORT_PID"
    kill -9 $PORT_PID
fi

echo "All cleanup complete."

source venv/bin/activate
export $(grep -v '^#' .env | xargs)

echo "Starting FRESH Uvicorn..."
nohup uvicorn backend.app.main:app --reload --port 8000 > backend.log 2>&1 &
NEW_PID=$!
echo "Started new backend with PID: $NEW_PID"

sleep 3
if ps -p $NEW_PID > /dev/null; then
   echo "Backend is running successfully."
   cat backend.log
else
   echo "Backend failed to start immediately. Checking logs:"
   cat backend.log
fi

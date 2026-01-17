
#!/bin/bash
echo "Force Killing Fuel-Up Advisor Backend..."

# Find ALL python/uvicorn processes related to this project
# Grep for 'uvicorn' and 'fuel-up-advisor'
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

# Double check port 8000
PORT_PID=$(lsof -t -i:8000)
if [ -n "$PORT_PID" ]; then
    echo "Killing process on port 8000: $PORT_PID"
    kill -9 $PORT_PID
fi

echo "All cleanup complete."

# Activate venv and export env vars from .env
source venv/bin/activate
export $(grep -v '^#' .env | xargs)

echo "Starting FRESH Uvicorn..."
# Do NOT use nohup this time, run it in a way we can capture PID easily if needed, but nohup is safest for detachment
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

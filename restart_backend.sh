
#!/bin/bash
echo "Restarting Fuel-Up Advisor Backend..."

# Find PID of process listening on port 8000
PID=$(lsof -t -i:8000)

if [ -n "$PID" ]; then
  echo "Killing existing process on port 8000 (PID: $PID)..."
  kill -9 $PID
else
  echo "No process found on port 8000."
fi

# Activate venv and export env vars
source venv/bin/activate
# Export variables from .env (ignoring comments)
export $(grep -v '^#' .env | xargs)

echo "Starting Uvicorn..."
nohup uvicorn backend.app.main:app --reload --port 8000 > backend.log 2>&1 &

echo "Backend started in background. Logs are being written to backend.log"
sleep 2
cat backend.log

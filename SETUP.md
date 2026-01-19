# Fuel Up Advisor
Smart fuel decisions based on price trends.

## Initialization
### Option 1: Run Everything (Recommended)
```bash
./start.sh
```
This starts both backend and frontend, seeds the database, and shows you the URLs.

### Option 2: Run Separately
```bash
# Terminal 1 - Backend
./start-backend.sh

# Terminal 2 - Frontend  
./start-frontend.sh
```

### Option 3: Docker
```bash
docker compose up --build
```

---

## Demo Login
- **Email:** demo@example.com
- **Password:** demo1234

---

## URLs

| Service | Local | Docker |
|---------|-------|--------|
| Frontend | http://localhost:8080 | http://localhost |
| Backend | http://localhost:8000 | http://localhost:8000 |
| API Docs | http://localhost:8000/docs | http://localhost:8000/docs |

---

## Prerequisites

### Local Development
- **Python 3.12+** 
- **Node.js 20+**
- npm (comes with Node.js)

### Docker
- Docker Desktop (includes Docker Compose)

---

## Project Structure

```
fuel-up-advisor/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── db.py            # Database connection
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # JWT authentication
│   │   ├── domain/          # Business logic
│   │   │   ├── decision.py  # Fill-up decision rules
│   │   │   ├── forecast.py  # Price forecasting
│   │   │   └── explanation.py
│   │   └── routes/          # API endpoints
│   ├── tests/               # Backend tests
│   └── seed.py              # Demo data seeding
├── src/                     # React frontend
├── docker-compose.yml       # Docker orchestration
├── start.sh                 # Start both services
├── start-backend.sh         # Start backend only
└── start-frontend.sh        # Start frontend only
```

---

## Bash Scripts
| Script | Purpose |
|--------|---------|
| `./start.sh` | Start both backend + frontend together |
| `./start-backend.sh` | Start only the Python backend |
| `./start-frontend.sh` | Start only the React frontend |

---

## Manual Setup
### Backend
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed demo data
python -m backend.seed

# Run backend
uvicorn backend.app.main:app --port 8000
```

### Frontend
```bash
npm install
npm run dev
```

---

## Environment Variables
### Backend (.env)
```bash
DATABASE_URL=sqlite+aiosqlite:///./backend/fuelup.db  # SQLite (default)
# DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db  # Postgres
SECRET_KEY=your-secret-key
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:8000
```

---

## Docker Commands

```bash
# Start all services
docker compose up --build

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Rebuild specific service
docker compose up --build backend
```

---

## Running Tests
```bash
# Backend tests
source venv/bin/activate
pip install pytest
pytest backend/tests/
```

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (local) / PostgreSQL (Docker) |
| Auth | JWT tokens |

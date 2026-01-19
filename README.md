# Fuelio
Fuelio helps drivers make smarter fill-up decisions by combining live gas prices with price trend forecasting and your driving patterns. It shows nearby stations on a map, estimates trip fuel costs for your vehicle, and gives clear recommendations on whether to fill up now or wait.

## Inspiration
With fuel prices fluctuating wildly and the cost of living increasing, we realized that drivers needed smarter tools than just "current price" apps. We built this advisor to use data and AI to help people time their fill-ups perfectly and save money on every tank.

## Overview 
Fuelio is a smart application designed to help drivers optimize their fuel spending. It analyzes real-time gas prices, tracks your driving history, and uses AI to recommend exactly when and where to fill up. It takes the stress out of finding cheap gas and ensures you never overpay at the pump.
#### Frontend
*   **React (Vite)**: Fast build tool and component-based UI.
*   **TypeScript**: Type-safe code for reliability.
*   **Tailwind CSS**: Utility-first styling for a premium, custom design.
*   **Shadcn UI**: Accessible, re-usable component library.
#### Backend
*   **FastAPI**: High-performance, async Python web framework.
*   **Uvicorn**: ASGI server implementation.
*   **PyFuelPrices**: Custom library integration for real-time fuel data.
<p>
<video src="" controls></video>
</p>

## Installation
```bash
docker compose up --build
```
Then open http://localhost in your browser.

**Demo credentials:** `demo@example.com` / `demo1234`

## Quick Start (Local Development)

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

### Backend
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/fuelup
export SECRET_KEY=your-secret-key

# Run the backend
uvicorn backend.app.main:app --reload --port 8000

# In another terminal, seed the database
python -m backend.seed
```

### Frontend
```bash
npm install
npm run dev
```

Open http://localhost:8080

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/fuelup` |
| `SECRET_KEY` | JWT secret key | - |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |

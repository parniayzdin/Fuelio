# Fuelio
Fuelio helps drivers make smarter fill-up decisions by combining live gas prices with price trend forecasting and your driving patterns. It shows nearby stations on a map, estimates trip fuel costs for your vehicle, and gives clear recommendations on whether to fill up now or wait.

## Inspiration
With fuel prices fluctuating wildly and the cost of living increasing, we realized that drivers needed smarter tools than just "current price" apps. We built this advisor to use data and AI to help people time their fill-ups perfectly and save money on every tank.

## Overview 
#### Frontend
*   **React (Vite)**: Fast build tool and component-based UI.
*   **TypeScript**: Type-safe code for reliability.
*   **Tailwind CSS**: Utility-first styling for a premium, custom design.
*   **Shadcn UI**: Accessible, re-usable component library.
#### Backend
*   **FastAPI**: Async Python web framework.
*   **Uvicorn**: ASGI server implementation.
*   **PyFuelPrices**: Custom library integration for real-time fuel data.

## Installation
### Local Development
```bash
docker compose up --build
```
Then open http://localhost in your browser.

**Demo credentials:** `demo@example.com` / `demo1234`

### AWS Cloud Deployment
Deploy to AWS cloud infrastructure for production use:

```bash
#See DEPLOYMENT.md for complete instructions
./aws/deploy.sh
```
**Features:**
- AWS ECS Fargate serverless containers
- AWS RDS managed PostgreSQL database
- Application Load Balancer for high availability
- CloudWatch monitoring and logging

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed AWS deployment instructions.

## Initialization (Local Development)
### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

### Backend
```bash
#Create virtual environment
python3 -m venv venv
source venv/bin/activate

#Install dependencies
pip install -r requirements.txt

#Set environment variables
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/fuelup
export SECRET_KEY=your-secret-key

#Run the backend
uvicorn backend.app.main:app --reload --port 8000

#In another terminal, seed the database
python -m backend.seed
```

### Frontend
```bash
npm install
npm run dev
```
Open http://localhost:8080


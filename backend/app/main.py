from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, Base
from .routes.auth import router as auth_router, me_router
from .routes.vehicle import router as vehicle_router
from .routes.trips import router as trips_router
from .routes.fillups import router as fillups_router
from .routes.prices import router as prices_router
from .routes.decision import router as decision_router
from .routes.ai import router as ai_router
from .routes.alerts import router as alerts_router
from .routes.news_analysis import router as news_router
from .routes.gas_stations import router as gas_stations_router
from .routes.trip_recommendation import router as trip_recommendation_router
from .routes.receipt_upload import router as receipt_router
from .routes.credit_cards import router as credit_cards_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Fuel Up Advisor API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(me_router)
app.include_router(vehicle_router)
app.include_router(trips_router)
app.include_router(fillups_router)
app.include_router(prices_router)
app.include_router(decision_router)
app.include_router(ai_router)
app.include_router(alerts_router)
app.include_router(news_router)
app.include_router(gas_stations_router)
app.include_router(trip_recommendation_router)
app.include_router(receipt_router)
app.include_router(credit_cards_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

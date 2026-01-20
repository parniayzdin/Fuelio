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
from .routes.gas_stations import router as gas_stations_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Fuelio API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(me_router)
app.include_router(vehicle_router)
app.include_router(trips_router)
app.include_router(fillups_router)
app.include_router(prices_router)
app.include_router(decision_router)
app.include_router(gas_stations_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

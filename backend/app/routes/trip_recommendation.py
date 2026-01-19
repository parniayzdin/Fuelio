from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import os
import google.generativeai as genai
from typing import Optional
import uuid

from ..models import User, Trip, Vehicle
from ..db import get_db
from ..auth import get_current_user
from ..optimization import optimize_fuel_purchases
from ..vector_store import OptimizationVectorStore

router = APIRouter()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

vector_store = OptimizationVectorStore()

@router.get("/trip-recommendation")
async def get_trip_recommendation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI-powered fuel recommendation based on CPLEX optimization + Gemini RAG."""
    
    now = datetime.utcnow()
    result = await db.execute(
        select(Trip)
        .where(Trip.user_id == current_user.id)
        .where(Trip.start_time > now)
        .order_by(Trip.start_time)
    )
    upcoming_trips = result.scalars().all()
    
    if not upcoming_trips:
        return {
            "recommendation": "NO_TRIPS",
            "reasoning": "You have no upcoming trips scheduled. Create a trip on the map to get recommendations!",
            "estimated_savings": 0,
            "next_trip_details": None,
            "confidence": "N/A"
        }
    
    vehicle_result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == current_user.id)
    )
    vehicle = vehicle_result.scalar_one_or_none()
    
    if not vehicle:
        return {
            "recommendation": "NO_VEHICLE",
            "reasoning": "Please configure your vehicle first to get recommendations.",
            "estimated_savings": 0,
            "next_trip_details": None,
            "confidence": "N/A"
        }
    
    trips_data = [
        {
            'distance_km': trip.distance_km or 0,
            'start_time': trip.start_time.isoformat()
        }
        for trip in upcoming_trips
    ]
    
    stations = [
        {'price': 1.45, 'location': 'Station A'},
        {'price': 1.50, 'location': 'Station B'},
        {'price': 1.48, 'location': 'Station C'},
    ]
    
    current_fuel = vehicle.tank_size_liters * 0.5
    
    optimization_result = optimize_fuel_purchases(
        trips=trips_data,
        stations=stations,
        current_fuel_level=current_fuel,
        tank_capacity=vehicle.tank_size_liters,
        efficiency_l_per_100km=vehicle.efficiency_l_per_100km,
        reserve_fraction=vehicle.reserve_fraction
    )
    
    opt_id = str(uuid.uuid4())
    context = {
        'timestamp': now.isoformat(),
        'num_trips': len(trips_data),
        'vehicle_efficiency': vehicle.efficiency_l_per_100km
    }
    vector_store.store_optimization(opt_id, optimization_result, context)
    
    query = f"Optimization with {len(trips_data)} trips, status {optimization_result.get('status')}"
    similar_opts = vector_store.retrieve_similar(query, n_results=2)
    
    rag_context = "\n\n".join([
        f"Past Optimization {i+1}:\n{opt['document']}"
        for i, opt in enumerate(similar_opts)
    ])
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""You are an expert fuel advisor analyzing CPLEX optimization results.

CURRENT OPTIMIZATION RESULT:
Status: {optimization_result.get('status')}
Total Cost: ${optimization_result.get('total_cost', 0):.2f}
Fill Schedule: {optimization_result.get('fill_schedule')}
Solver Log: {optimization_result.get('solver_log')}

SIMILAR PAST OPTIMIZATIONS (RAG CONTEXT):
{rag_context}

Based on the CPLEX optimization and similar past cases, provide a clear recommendation:

1. RECOMMENDATION: Should the user [FILL_NOW, WAIT, FILL_BEFORE_TRIP]?
2. REASONING: Explain in 2-3 sentences WHY this is optimal according to the CPLEX model
3. ESTIMATED_SAVINGS: How much money could be saved vs filling up now? (number only)
4. CONFIDENCE: [HIGH, MEDIUM, LOW] based on optimization status and solution quality

Format your response EXACTLY as:
RECOMMENDATION: [your answer]
REASONING: [your explanation]
ESTIMATED_SAVINGS: [dollar amount]
CONFIDENCE: [HIGH/MEDIUM/LOW]"""

    try:
        response = model.generate_content(prompt)
        ai_response = response.text
        
        lines = ai_response.strip().split('\n')
        recommendation = "FILL_NOW"
        reasoning = "Recommended by optimization model."
        estimated_savings = 0
        confidence = "MEDIUM"
        
        for line in lines:
            if line.startswith("RECOMMENDATION:"):
                recommendation = line.split(":", 1)[1].strip()
            elif line.startswith("REASONING:"):
                reasoning = line.split(":", 1)[1].strip()
            elif line.startswith("ESTIMATED_SAVINGS:"):
                try:
                    savings_str = line.split(":", 1)[1].strip().replace("$", "").strip()
                    estimated_savings = float(savings_str)
                except:
                    estimated_savings = 0
            elif line.startswith("CONFIDENCE:"):
                confidence = line.split(":", 1)[1].strip()
        
        next_trip = upcoming_trips[0]
        return {
            "recommendation": recommendation,
            "reasoning": reasoning,
            "estimated_savings": estimated_savings,
            "next_trip_details": {
                "distance_km": next_trip.distance_km,
                "start_time": next_trip.start_time.isoformat(),
                "hours_until": (next_trip.start_time - now).total_seconds() / 3600
            },
            "confidence": confidence,
            "optimization_status": optimization_result.get('status')
        }
        
    except Exception as e:
        next_trip = upcoming_trips[0]
        return {
            "recommendation": "FILL_BEFORE_TRIP",
            "reasoning": f"Optimization recommends filling before your {next_trip.distance_km:.0f} km trip.",
            "estimated_savings": 0,
            "next_trip_details": {
                "distance_km": next_trip.distance_km,
                "start_time": next_trip.start_time.isoformat(),
                "hours_until": (next_trip.start_time - now).total_seconds() / 3600
            },
            "confidence": "LOW",
            "optimization_status": optimization_result.get('status'),
            "error": str(e)
        }

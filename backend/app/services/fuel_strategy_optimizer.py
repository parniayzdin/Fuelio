"""
AI Fuel Strategy Optimizer using Pyomo

Mathematical optimization to determine optimal fuel stops along a trip route,
considering gas station locations, price forecasts, and credit card cashback.
"""
import json
import math
from typing import Optional
from dataclasses import dataclass
from datetime import date, timedelta

import os
import google.generativeai as genai

from pyomo.environ import (
    ConcreteModel, Var, Objective, Constraint, 
    Binary, NonNegativeReals, minimize, SolverFactory, value
)

@dataclass
class TripPoint:
    """A point along the trip route."""
    lat: float
    lng: float
    km_from_start: float = 0.0

@dataclass
class GasStationData:
    """Gas station with pricing data."""
    id: str
    name: str
    brand: str
    lat: float
    lng: float
    address: str
    km_along_route: float
    base_prices: dict
    best_card: Optional[str] = None
    cashback_percent: float = 0.0
    
    def effective_price(self, day_offset: int = 0) -> float:
        """Get effective price after cashback for a given day."""
        base = self.base_prices.get(day_offset, self.base_prices.get(0, 1.50))
        return base * (1 - self.cashback_percent / 100.0)

@dataclass  
class FillUpStop:
    """Recommended fill-up stop."""
    station: GasStationData
    day_offset: int
    liters_to_fill: float
    effective_price: float
    base_price: float
    card_to_use: Optional[str]
    fuel_level_before: float
    fuel_level_after: float
    km_at_stop: float
    savings_from_card: float
    savings_from_timing: float

@dataclass
class OptimizationResult:
    """Result of fuel strategy optimization."""
    stops: list[FillUpStop]
    total_cost: float
    total_savings: float
    reasoning: list[str]
    fuel_projection: list[dict]
    solver_status: str

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in km."""
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad)*math.cos(lat2_rad)*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def point_to_segment_distance(point: tuple, seg_start: tuple, seg_end: tuple) -> float:
    """Calculate perpendicular distance from point to line segment in km."""
    px, py = point
    ax, ay = seg_start
    bx, by = seg_end
    
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    
    ab_sq = abx*abx + aby*aby
    if ab_sq == 0:
        return haversine_km(px, py, ax, ay)
    
    t = max(0, min(1, (apx*abx + apy*aby) / ab_sq))
    
    closest_x = ax + t * abx
    closest_y = ay + t * aby
    
    return haversine_km(px, py, closest_x, closest_y)

def find_stations_along_route(
    route_points: list[TripPoint],
    all_stations: list[dict],
    radius_km: float = 20.0
) -> list[GasStationData]:
    """
    Find all gas stations within radius_km of the route.
    Returns stations with their km_along_route position.
    """
    found_stations = []
    
    for station in all_stations:
        slat, slng = station['lat'], station['lng']
        
        min_dist = float('inf')
        closest_km = 0
        cumulative_km = 0
        
        for i in range(len(route_points) - 1):
            p1, p2 = route_points[i], route_points[i+1]
            seg_dist = point_to_segment_distance(
                (slat, slng), (p1.lat, p1.lng), (p2.lat, p2.lng)
            )
            
            if seg_dist < min_dist:
                min_dist = seg_dist
                segment_len = haversine_km(p1.lat, p1.lng, p2.lat, p2.lng)
                closest_km = cumulative_km + segment_len / 2
            
            cumulative_km += haversine_km(p1.lat, p1.lng, p2.lat, p2.lng)
        
        if min_dist <= radius_km:
            found_stations.append(GasStationData(
                id=station.get('id', station.get('place_id', '')),
                name=station.get('name', 'Gas Station'),
                brand=station.get('brand', 'Unknown'),
                lat=slat,
                lng=slng,
                address=station.get('address', ''),
                km_along_route=closest_km,
                base_prices={0: station.get('regular', 1.50)}
            ))
    
    found_stations.sort(key=lambda s: s.km_along_route)
    return found_stations

def apply_card_benefits(stations: list[GasStationData], user_cards: list[dict]) -> None:
    """Apply credit card cashback rates to stations."""
    for station in stations:
        best_cashback = 0.0
        best_card = None
        
        for card in user_cards:
            cashback = card.get('cashback', 0) or 0
            if cashback > best_cashback:
                best_cashback = cashback
                best_card = card.get('provider', 'Unknown Card')
        
        station.cashback_percent = best_cashback
        station.best_card = best_card

def add_price_forecasts(stations: list[GasStationData], forecast_days: int = 7) -> None:
    """Add 7-day price forecasts to each station."""
    from ..domain.forecast import generate_forecast
    
    for station in stations:
        today_price = station.base_prices.get(0, 1.50)
        forecasts = generate_forecast(today_price, [today_price] * 7, days=forecast_days)
        
        for i, fc in enumerate(forecasts):
            station.base_prices[i + 1] = fc['predicted_price']

def build_optimization_model(
    stations: list[GasStationData],
    route_points: list[TripPoint],
    tank_size_liters: float,
    efficiency_l_per_100km: float,
    initial_fuel_pct: float,
    forecast_days: int = 7,
    reserve_liters: float = 5.0
) -> tuple[ConcreteModel, dict]:
    """
    Build Pyomo optimization model for fuel strategy.
    
    Returns (model, metadata) where metadata contains mappings for interpretation.
    """
    model = ConcreteModel("FuelStrategy")
    
    total_km = sum(
        haversine_km(route_points[i].lat, route_points[i].lng,
                     route_points[i+1].lat, route_points[i+1].lng)
        for i in range(len(route_points) - 1)
    )
    
    total_fuel_needed = (total_km * efficiency_l_per_100km) / 100.0
    initial_fuel = tank_size_liters * (initial_fuel_pct / 100.0)
    
    num_stations = len(stations)
    num_days = forecast_days
    
    if num_stations == 0:
        raise ValueError("No gas stations found along the route")
    
    model.STATIONS = range(num_stations)
    model.DAYS = range(num_days)
    
    model.x = Var(model.STATIONS, model.DAYS, domain=Binary)
    model.liters = Var(model.STATIONS, model.DAYS, domain=NonNegativeReals, bounds=(0, tank_size_liters))
    
    eff_prices = {}
    for s in model.STATIONS:
        for d in model.DAYS:
            eff_prices[(s,d)] = stations[s].effective_price(d)
    
    def obj_rule(m):
        return sum(
            eff_prices[(s,d)] * m.liters[s,d]
            for s in m.STATIONS for d in m.DAYS
        )
    model.objective = Objective(rule=obj_rule, sense=minimize)
    
    def fuel_sufficiency_rule(m):
        total_purchased = sum(m.liters[s,d] for s in m.STATIONS for d in m.DAYS)
        fuel_deficit = max(0, total_fuel_needed - initial_fuel + reserve_liters)
        return total_purchased >= fuel_deficit
    model.fuel_sufficiency = Constraint(rule=fuel_sufficiency_rule)
    
    def tank_capacity_rule(m):
        total_purchased = sum(m.liters[s,d] for s in m.STATIONS for d in m.DAYS)
        return total_purchased + initial_fuel <= tank_size_liters + total_fuel_needed
    model.tank_capacity = Constraint(rule=tank_capacity_rule)
    
    def link_rule(m, s, d):
        return m.liters[s,d] <= tank_size_liters * m.x[s,d]
    model.link = Constraint(model.STATIONS, model.DAYS, rule=link_rule)
    
    def one_fill_per_station_rule(m, s):
        return sum(m.x[s,d] for d in m.DAYS) <= 1
    model.one_fill_per_station = Constraint(model.STATIONS, rule=one_fill_per_station_rule)
    
    def max_fills_rule(m):
        return sum(m.x[s,d] for s in m.STATIONS for d in m.DAYS) <= 2
    model.max_fills = Constraint(rule=max_fills_rule)
    
    metadata = {
        'total_km': total_km,
        'total_fuel_needed': total_fuel_needed,
        'initial_fuel': initial_fuel,
        'eff_prices': eff_prices,
        'stations': stations,
        'route_points': route_points,
        'efficiency': efficiency_l_per_100km,
        'tank_size': tank_size_liters
    }
    
    return model, metadata

def solve_greedy_heuristic(metadata: dict) -> OptimizationResult:
    """
    Fallback heuristic when no solver is available.
    Strategy: Find lowest price station reachable from start, fill enough to finish.
    """
    stations = metadata['stations']
    tank_size = metadata['tank_size']
    initial_fuel = metadata['initial_fuel']
    fuel_needed = metadata['total_fuel_needed']
    efficiency = metadata['efficiency']
    
    if initial_fuel >= fuel_needed:
        return OptimizationResult(
            stops=[],
            total_cost=0,
            total_savings=0,
            reasoning=["No stops needed - you have enough fuel to reach destination!"],
            fuel_projection=build_fuel_projection([], metadata['route_points'], initial_fuel, tank_size, efficiency),
            solver_status="heuristic_no_stop"
        )

    reachable_range_km = (initial_fuel / efficiency) * 100
    candidates = [
        s for s in stations 
        if s.km_along_route <= reachable_range_km
    ]
    candidates.sort(key=lambda s: s.effective_price(0))
    
    if not candidates:
        return OptimizationResult(stops=[], total_cost=0, total_savings=0, reasoning=["No reachable stations found with current fuel."], fuel_projection=[], solver_status="heuristic_failed")

    best_station = candidates[0]
    
    dist_remaining = metadata['total_km'] - best_station.km_along_route
    fuel_for_remainder = (dist_remaining * efficiency) / 100.0
    
    target_fill = fuel_for_remainder + 5.0
    fuel_on_arrival = initial_fuel - (best_station.km_along_route * efficiency / 100.0)
    liters_to_add = target_fill - fuel_on_arrival
    
    space_in_tank = tank_size - fuel_on_arrival
    liters_to_add = min(liters_to_add, space_in_tank)
    
    price = best_station.effective_price(0)
    cost = liters_to_add * price
    base_price = best_station.base_prices.get(0, 1.50)
    savings = liters_to_add * base_price * (best_station.cashback_percent / 100.0)

    stop = FillUpStop(
        station=best_station,
        day_offset=0,
        liters_to_fill=round(liters_to_add, 1),
        effective_price=round(price, 3),
        base_price=round(base_price, 3),
        card_to_use=best_station.best_card,
        fuel_level_before=round(fuel_on_arrival, 1),
        fuel_level_after=round(fuel_on_arrival + liters_to_add, 1),
        km_at_stop=best_station.km_along_route,
        savings_from_card=round(savings, 2),
        savings_from_timing=0
    )
    
    projection = build_fuel_projection([stop], metadata['route_points'], initial_fuel, tank_size, efficiency)
    
    return OptimizationResult(
        stops=[stop],
        total_cost=round(cost, 2),
        total_savings=round(savings, 2),
        reasoning=[
            f"Heuristic Recommendation (Optimizer unavailable):",
            f"Fill {liters_to_add:.1f}L at {best_station.name} (${price:.3f}/L)",
            f"It's the cheapest reachable station along your route."
        ],
        fuel_projection=projection,
        solver_status="heuristic_optimal"
    )

def solve_model(model: ConcreteModel) -> str:
    """Solve the optimization model. Returns solver status."""
    solvers = ['cplex', 'cbc', 'glpk', 'appsi_highs']
    
    for solver_name in solvers:
        try:
            solver = SolverFactory(solver_name)
            if solver.available():
                print(f"Using solver: {solver_name}")
                result = solver.solve(model, tee=False)
                return str(result.solver.termination_condition)
        except:
            continue
    
    return "solver_not_found"

def extract_solution(model: ConcreteModel, metadata: dict) -> OptimizationResult:
    """Extract solution from solved model."""
    stations = metadata['stations']
    stops = []
    reasoning = []
    
    total_cost = 0.0
    total_savings = 0.0
    
    for s in model.STATIONS:
        for d in model.DAYS:
            if value(model.x[s,d]) > 0.5:
                liters = value(model.liters[s,d])
                if liters > 0.1:
                    station = stations[s]
                    eff_price = station.effective_price(d)
                    base_price = station.base_prices.get(d, station.base_prices.get(0, 1.50))
                    
                    card_savings = liters * base_price * (station.cashback_percent / 100.0)
                    
                    today_price = station.effective_price(0)
                    timing_savings = (today_price - eff_price) * liters if today_price > eff_price else 0
                    
                    stops.append(FillUpStop(
                        station=station,
                        day_offset=d,
                        liters_to_fill=round(liters, 1),
                        effective_price=round(eff_price, 3),
                        base_price=round(base_price, 3),
                        card_to_use=station.best_card,
                        fuel_level_before=0,
                        fuel_level_after=0,
                        km_at_stop=station.km_along_route,
                        savings_from_card=round(card_savings, 2),
                        savings_from_timing=round(timing_savings, 2)
                    ))
                    
                    total_cost += liters * eff_price
                    total_savings += card_savings + timing_savings
                    
                    if d == 0:
                        reasoning.append(
                            f"Fill {liters:.1f}L at {station.name} today at ${eff_price:.3f}/L"
                        )
                    else:
                        day_name = (date.today() + timedelta(days=d)).strftime("%A")
                        reasoning.append(
                            f"Wait until {day_name} to fill {liters:.1f}L at {station.name} - "
                            f"price drops to ${eff_price:.3f}/L"
                        )
                    
                    if station.best_card:
                        reasoning.append(
                            f"  → Use {station.best_card} for {station.cashback_percent}% cashback "
                            f"(saves ${card_savings:.2f})"
                        )
    
    if not stops:
        reasoning.append("No fill-up needed - you have enough fuel for the trip!")
    
    stops.sort(key=lambda s: s.km_at_stop)
    
    fuel_projection = build_fuel_projection(
        stops, metadata['route_points'], 
        metadata['initial_fuel'], metadata['tank_size'],
        metadata['efficiency']
    )
    
    return OptimizationResult(
        stops=stops,
        total_cost=round(total_cost, 2),
        total_savings=round(total_savings, 2),
        reasoning=reasoning,
        fuel_projection=fuel_projection,
        solver_status="optimal"
    )

def build_fuel_projection(
    stops: list[FillUpStop],
    route_points: list[TripPoint],
    initial_fuel: float,
    tank_size: float,
    efficiency: float
) -> list[dict]:
    """Build fuel level projection along the route."""
    projection = []
    current_fuel = initial_fuel
    
    total_km = 0
    for i in range(len(route_points) - 1):
        total_km += haversine_km(
            route_points[i].lat, route_points[i].lng,
            route_points[i+1].lat, route_points[i+1].lng
        )
    
    sample_points = list(range(0, int(total_km) + 1, 10))
    if total_km not in sample_points:
        sample_points.append(int(total_km))
    
    stop_kms = {s.km_at_stop: s for s in stops}
    
    prev_km = 0
    for km in sample_points:
        consumed = ((km - prev_km) * efficiency) / 100.0
        current_fuel -= consumed
        
        action = None
        
        for stop_km, stop in stop_kms.items():
            if abs(km - stop_km) < 5:
                current_fuel += stop.liters_to_fill
                current_fuel = min(current_fuel, tank_size)
                action = f"FILL {stop.liters_to_fill:.0f}L at {stop.station.name}"
        
        fuel_pct = (current_fuel / tank_size) * 100
        
        projection.append({
            "km": km,
            "fuel_pct": round(max(0, fuel_pct), 1),
            "action": action
        })
        
        prev_km = km
    
    return projection

def explain_strategy_with_llm(result: OptimizationResult, initial_context: dict) -> list[str]:
    """Use Gemini to explain the greedy strategy in a helpful way."""
    try:
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        stops_desc = "\n".join([
            f"- Stop at {s.station.name}: Fill {s.liters_to_fill}L at ${s.effective_price:.3f}/L (save ${s.savings_from_card:.2f} with {s.card_to_use})"
            for s in result.stops
        ])
        
        prompt = f"""
        You are an expert fuel savings advisor. Explain this fueling strategy to a user clearly and concisely.
        
        TRIP CONTEXT:
        - Total Distance: {initial_context.get('total_km', 0):.0f} km
        - Current Fuel: {initial_context.get('current_fuel_percent', 0)}%
        - Vehicle Tank: {initial_context.get('tank_size_liters', 0)}L
        
        OPTIMIZED STRATEGY (Greedy Lowest Price):
        {stops_desc if result.stops else "No stops needed - enough fuel to reach destination."}
        
        TOTAL COST: ${result.total_cost:.2f}
        TOTAL SAVINGS: ${result.total_savings:.2f}
        
        Please provide 2-3 bullet points explaining:
        1. Why this strategy is good (mention price/savings)
        2. Specific advice on which card to use if applicable
        3. A friendly closing tip.
        
        Keep it under 100 words. Do NOT use markdown bolding/headers, just plain text bullet points.
        """
        
        response = model.generate_content(prompt)
        return [line.strip().lstrip('- ') for line in response.text.strip().split('\n') if line.strip()]
        
    except Exception as e:
        print(f"LLM generation failed: {e}")
        return result.reasoning  # Fallback to existing reasoning

async def optimize_fuel_strategy(
    route_points: list[dict],
    all_stations: list[dict],
    user_cards: list[dict],
    tank_size_liters: float = 50.0,
    efficiency_l_per_100km: float = 8.0,
    current_fuel_percent: float = 30.0,
    search_radius_km: float = 20.0,
    forecast_days: int = 7
) -> OptimizationResult:
    """
    Main entry point: Optimize fuel strategy for a trip.
    Now uses Greedy Heuristic + Gemini LLM exclusively.
    """
    # Convert route points
    trip_points = [TripPoint(lat=p['lat'], lng=p['lng']) for p in route_points]
    
    # Find stations along route
    stations = find_stations_along_route(trip_points, all_stations, search_radius_km)
    
    if not stations:
        return OptimizationResult(
            stops=[],
            total_cost=0,
            total_savings=0,
            reasoning=["No gas stations found within search radius of route"],
            fuel_projection=[],
            solver_status="no_stations"
        )
    
    # Apply credit card benefits
    apply_card_benefits(stations, user_cards)
    
    # Add price forecasts (still useful for display even if greedy uses today's price)
    add_price_forecasts(stations, forecast_days)
    
    # Calculate minimal metadata for heuristic
    total_km = sum(
        haversine_km(trip_points[i].lat, trip_points[i].lng,
                     trip_points[i+1].lat, trip_points[i+1].lng)
        for i in range(len(trip_points) - 1)
    )
    total_fuel_needed = (total_km * efficiency_l_per_100km) / 100.0
    initial_fuel = tank_size_liters * (current_fuel_percent / 100.0)
    
    metadata = {
        'stations': stations,
        'tank_size': tank_size_liters,
        'initial_fuel': initial_fuel,
        'total_fuel_needed': total_fuel_needed,
        'efficiency': efficiency_l_per_100km,
        'route_points': trip_points,
        'total_km': total_km
    }
    
    # Build and solve optimization model
    # Priority: Try CPLEX/Pyomo ONLY
    try:
        model, metadata = build_optimization_model(
            stations=stations,
            route_points=trip_points,
            tank_size_liters=tank_size_liters,
            efficiency_l_per_100km=efficiency_l_per_100km,
            initial_fuel_pct=current_fuel_percent,
            forecast_days=forecast_days
        )
        
        status = solve_model(model)
        
        if "optimal" in status.lower() or "feasible" in status.lower():
            return extract_solution(model, metadata)
        else:
            print(f"Solver status {status}. CPLEX optimization failed.")
            return OptimizationResult(
                stops=[],
                total_cost=0,
                total_savings=0,
                reasoning=[f"CPLEX Optimization Failed: Status {status}"],
                fuel_projection=[],
                solver_status=f"error: {status}"
            )
            
    except Exception as e:
        print(f"Pyomo optimization failed: {e}")
        return OptimizationResult(
            stops=[],
            total_cost=0,
            total_savings=0,
            reasoning=[f"Optimization Error: {str(e)}"],
            fuel_projection=[],
            solver_status=f"error: {str(e)}"
        )

    # Enhance reasoning with LLM if result is valid
    if result and result.stops:
        llm_context = {
            'total_km': total_km,
            'current_fuel_percent': current_fuel_percent,
            'tank_size_liters': tank_size_liters
        }
        
        llm_explanation = explain_strategy_with_llm(result, llm_context)
        if llm_explanation:
            result.reasoning = llm_explanation
        
    return result

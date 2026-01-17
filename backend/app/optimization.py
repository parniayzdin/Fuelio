"""
CPLEX MINLP Optimization for Fuel Purchase Decisions
"""
from docplex.mp.model import Model
from typing import List, Dict, Tuple
from datetime import datetime, timedelta


def optimize_fuel_purchases(
    trips: List[Dict],
    stations: List[Dict],
    current_fuel_level: float,
    tank_capacity: float,
    efficiency_l_per_100km: float,
    reserve_fraction: float = 0.1
) -> Dict:
    """
    Solve MINLP to find optimal fuel purchase strategy.
    
    Args:
        tr trips: List of upcoming trips with {distance_km, start_time}
        stations: List of stations with {price, location}
        current_fuel_level: Current fuel in liters
        tank_capacity: Maximum tank capacity in liters
        efficiency_l_per_100km: Vehicle fuel efficiency
        reserve_fraction: Minimum reserve fuel fraction
        
    Returns:
        Dict with optimization results and logs
    """
    
    # Create CPLEX model
    mdl = Model(name='FuelOptimization')
    
    # Time periods (days)
    num_periods = max(7, len(trips))
    periods = range(num_periods)
    
    # Decision variables
    # fx[t, s] = 1 if we fill up at station s in period t
    fill_decisions = mdl.binary_var_dict(
        ((t, s) for t in periods for s in range(len(stations))),
        name="fill"
    )
    
    # fill_amount[t, s] = liters filled at station s in period t
    fill_amounts = mdl.continuous_var_dict(
        ((t, s) for t in periods for s in range(len(stations))),
        lb=0,
        ub=tank_capacity,
        name="fill_amount"
    )
    
    # fuel_level[t] = fuel level at end of period t
    fuel_levels = mdl.continuous_var_dict(
        periods,
        lb=tank_capacity * reserve_fraction,
        ub=tank_capacity,
        name="fuel_level"
    )
    
    #  ==== OBJECTIVE ====
    # Minimize total fuel cost
    total_cost = mdl.sum(
        fill_amounts[t, s] * stations[s].get('price', 1.50)
        for t in periods
        for s in range(len(stations))
    )
    mdl.minimize(total_cost)
    
    # ==== CONSTRAINTS ====
    
    # Initial fuel level
    mdl.add_constraint(
        fuel_levels[0] == current_fuel_level + mdl.sum(fill_amounts[0, s] for s in range(len(stations))) - sum(
            trip['distance_km'] * efficiency_l_per_100km / 100
            for trip in trips
            if (datetime.fromisoformat(trip['start_time']) - datetime.utcnow()).days == 0
        ),
        "initial_fuel"
    )
    
    # Fuel level propagation
    for t in periods[1:]:
        trips_in_period = [
            trip for trip in trips
            if (datetime.fromisoformat(trip['start_time']) - datetime.utcnow()).days == t
        ]
        fuel_consumed = sum(
            trip['distance_km'] * efficiency_l_per_100km / 100
            for trip in trips_in_period
        )
        
        mdl.add_constraint(
            fuel_levels[t] == fuel_levels[t-1] + 
            mdl.sum(fill_amounts[t, s] for s in range(len(stations))) -
            fuel_consumed,
            f"fuel_balance_{t}"
        )
    
    # Fill amount linked to fill decision
    for t in periods:
        for s in range(len(stations)):
            mdl.add_constraint(
                fill_amounts[t, s] <= fill_decisions[t, s] * tank_capacity,
                f"link_fill_{t}_{s}"
            )
    
    # Tank capacity constraint
    for t in periods:
        mdl.add_constraint(
            fuel_levels[t] <= tank_capacity,
            f"tank_cap_{t}"
        )
    
    # At most one fillup per period
    for t in periods:
        mdl.add_constraint(
            mdl.sum(fill_decisions[t, s] for s in range(len(stations))) <= 1,
            f"one_fill_{t}"
        )
    
    # Solve
    solution = mdl.solve(log_output=True)
    
    # Extract results
    if solution:
        fill_schedule = []
        for t in periods:
            for s in range(len(stations)):
                if fill_decisions[t, s].solution_value > 0.5:
                    fill_schedule.append({
                        'period': t,
                        'station_index': s,
                        'amount': fill_amounts[t, s].solution_value,
                        'cost': fill_amounts[t, s].solution_value * stations[s].get('price', 1.50)
                    })
        
        return {
            'status': 'OPTIMAL',
            'total_cost': solution.objective_value,
            'fill_schedule': fill_schedule,
            'solver_log': str(mdl.solve_details),
            'fuel_levels': {t: fuel_levels[t].solution_value for t in periods}
        }
    else:
        return {
            'status': 'INFEASIBLE',
            'total_cost': None,
            'fill_schedule': [],
            'solver_log': str(mdl.solve_details),
            'fuel_levels': {}
        }

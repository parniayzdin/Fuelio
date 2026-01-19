"""
Price forecasting logic.
Uses Linear Regression to predict future prices based on historical trends.
"""
from datetime import date, timedelta
from typing import Literal
import numpy as np
from sklearn.linear_model import LinearRegression

def calculate_trend(
    today_price: float, predicted_price: float
) -> Literal["rising", "flat", "falling"]:
    """Determine price trend based on delta."""
    delta = predicted_price - today_price
    if delta >= 0.02:
        return "rising"
    elif delta <= -0.02:
        return "falling"
    else:
        return "flat"

def generate_forecast(
    today_price: float,
    historical_prices: list[float],
    days: int = 7,
) -> list[dict]:
    """
    Generate price forecast for the next N days using Linear Regression.
    
    Args:
        today_price: Current day's price
        historical_prices: Prices from last 7 days (most recent first: [today, yesterday, ...])
        days: Number of days to forecast
    
    Returns:
        List of forecast dictionaries with day, predicted_price, delta, trend
    """
    if not historical_prices:
        return []

    # Prepare data for regression
    # historical_prices is [today, yesterday, 2days_ago...]
    # We want chronological: [oldest...newest]
    y = np.array(historical_prices[::-1])
    n_samples = len(y)
    
    # X axis is days [0, 1, ... n-1]
    X = np.arange(n_samples).reshape(-1, 1)

    # Train model
    model = LinearRegression()
    model.fit(X, y)

    forecasts = []
    base_date = date.today()

    # Predict for next 'days' days
    # If we have N sample (0..N-1), next day is N
    future_X = np.arange(n_samples, n_samples + days).reshape(-1, 1)
    predictions = model.predict(future_X)

    for i, predicted_price in enumerate(predictions, 1):
        forecast_date = base_date + timedelta(days=i)
        
        # Ensure we don't return negative prices (though unlikely with stable fuel data)
        predicted_price = max(0.01, predicted_price)

        delta = predicted_price - today_price
        trend = calculate_trend(today_price, predicted_price)

        forecasts.append({
            "day": forecast_date.isoformat(),
            "predicted_price": round(float(predicted_price), 3),
            "delta_from_today": round(float(delta), 3),
            "trend": trend,
        })

    return forecasts

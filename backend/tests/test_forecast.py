"""Tests for price forecast logic."""
import pytest
from backend.app.domain.forecast import (
    calculate_trend,
    generate_forecast,
)

class TestCalculateTrend:
    def test_rising_trend(self):
        result = calculate_trend(1.40, 1.45)
        assert result == "rising"

    def test_falling_trend(self):
        result = calculate_trend(1.45, 1.40)
        assert result == "falling"

    def test_flat_trend(self):
        result = calculate_trend(1.45, 1.46)
        assert result == "flat"

    def test_exact_threshold_rising(self):
        result = calculate_trend(1.45, 1.47)
        assert result == "rising"

    def test_exact_threshold_falling(self):
        result = calculate_trend(1.45, 1.43)
        assert result == "falling"

class TestGenerateForecast:
    def test_generates_correct_number_of_days(self):
        result = generate_forecast(1.45, [1.40, 1.42, 1.44, 1.46, 1.48, 1.50, 1.45], days=7)
        assert len(result) == 7

    def test_forecast_has_required_fields(self):
        result = generate_forecast(1.45, [1.45, 1.44, 1.42], days=3)
        for item in result:
            assert "day" in item
            assert "predicted_price" in item
            assert "delta_from_today" in item
            assert "trend" in item

    def test_linear_extrapolation(self):
        
        today_price = 1.7
        history = [1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1] 
        
        result = generate_forecast(today_price, history, days=1)
        prediction = result[0]["predicted_price"]
        assert 1.79 <= prediction <= 1.81
        assert result[0]["trend"] == "rising"

    def test_empty_history(self):
        result = generate_forecast(1.45, [], days=7)
        assert result == []

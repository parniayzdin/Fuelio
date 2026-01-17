"""Tests for decision logic."""
import pytest
from backend.app.domain.decision import (
    VehicleConfig,
    DecisionInput,
    make_decision,
    calculate_liters_remaining,
    calculate_range_km,
)


@pytest.fixture
def default_vehicle():
    return VehicleConfig(
        tank_size_liters=50.0,
        efficiency_l_per_100km=8.0,
        reserve_fraction=0.1,
    )


class TestCalculateLitersRemaining:
    def test_percent_anchor(self, default_vehicle):
        result = calculate_liters_remaining(default_vehicle, "percent", fuel_percent=50)
        assert result == 25.0

    def test_percent_anchor_full(self, default_vehicle):
        result = calculate_liters_remaining(default_vehicle, "percent", fuel_percent=100)
        assert result == 50.0

    def test_percent_anchor_empty(self, default_vehicle):
        result = calculate_liters_remaining(default_vehicle, "percent", fuel_percent=0)
        assert result == 0.0

    def test_date_anchor(self, default_vehicle):
        # Drove 100km at 8L/100km = 8L used
        result = calculate_liters_remaining(
            default_vehicle, "last_full_fillup_date", distance_since_fillup_km=100
        )
        assert result == 42.0

    def test_date_anchor_more_than_tank(self, default_vehicle):
        # Drove enough to use more than tank capacity
        result = calculate_liters_remaining(
            default_vehicle, "last_full_fillup_date", distance_since_fillup_km=1000
        )
        assert result == 0.0


class TestCalculateRangeKm:
    def test_basic_range(self):
        # 25L remaining, 5L reserve, 8L/100km efficiency
        # Usable = 20L, range = 20 / 0.08 = 250km
        result = calculate_range_km(25.0, 5.0, 8.0)
        assert result == 250.0

    def test_at_reserve(self):
        # 5L remaining, 5L reserve = 0 usable
        result = calculate_range_km(5.0, 5.0, 8.0)
        assert result == 0.0

    def test_below_reserve(self):
        # 3L remaining, 5L reserve = negative clipped to 0
        result = calculate_range_km(3.0, 5.0, 8.0)
        assert result == 0.0


class TestMakeDecision:
    def test_critical_low_fuel(self, default_vehicle):
        """When range is <= 30km, should recommend FILL with high severity."""
        input_data = DecisionInput(
            vehicle=default_vehicle,
            fuel_anchor_type="percent",
            fuel_percent=5,  # Very low
        )
        result = make_decision(input_data)
        assert result.decision == "FILL"
        assert result.severity == "high"

    def test_planned_trip_exceeds_range(self, default_vehicle):
        """When planned trip exceeds range, should recommend FILL."""
        input_data = DecisionInput(
            vehicle=default_vehicle,
            fuel_anchor_type="percent",
            fuel_percent=30,
            planned_trip_km=500,  # Way more than range
        )
        result = make_decision(input_data)
        assert result.decision == "FILL"
        assert result.severity == "high"

    def test_planned_trip_close_to_range(self, default_vehicle):
        """When planned trip is > 70% of range, should recommend FILL medium."""
        input_data = DecisionInput(
            vehicle=default_vehicle,
            fuel_anchor_type="percent",
            fuel_percent=50,  # 25L = ~250km range after reserve
            planned_trip_km=200,  # > 70% of 250km
        )
        result = make_decision(input_data)
        assert result.decision == "FILL"
        assert result.severity == "medium"

    def test_rising_prices_low_range(self, default_vehicle):
        """When prices rising and range < 120km, should recommend FILL."""
        input_data = DecisionInput(
            vehicle=default_vehicle,
            fuel_anchor_type="percent",
            fuel_percent=20,  # ~100km range
            today_price=1.40,
            predicted_tomorrow=1.50,  # Rising by 10 cents
        )
        result = make_decision(input_data)
        assert result.decision == "FILL"
        assert result.severity == "medium"

    def test_no_action_needed(self, default_vehicle):
        """When fuel is good and prices stable, no action needed."""
        input_data = DecisionInput(
            vehicle=default_vehicle,
            fuel_anchor_type="percent",
            fuel_percent=80,  # Plenty of fuel
            today_price=1.45,
            predicted_tomorrow=1.45,  # Stable
        )
        result = make_decision(input_data)
        assert result.decision == "NO_ACTION"
        assert result.severity == "low"

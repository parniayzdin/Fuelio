"""
Explanation generator for fuel decisions.
Produces templated text explanations that can be swapped for LLM later.
"""
from typing import Literal, Optional


def generate_explanation(
    decision: Literal["FILL", "NO_ACTION"],
    severity: Literal["low", "medium", "high"],
    range_km: float,
    liters_remaining: Optional[float] = None,
    planned_trip_km: Optional[float] = None,
    price_trend: Optional[Literal["rising", "flat", "falling"]] = None,
    price_delta: Optional[float] = None,
    today_price: Optional[float] = None,
) -> str:
    """
    Generate a human-readable explanation for the decision.
    
    This is a template-based approach that can be replaced with LLM generation later.
    """
    parts = []

    if decision == "FILL":
        if severity == "high":
            if range_km <= 30:
                parts.append(f"Your estimated range is only {range_km:.0f} km, which is critically low.")
            elif liters_remaining and liters_remaining <= 5:
                parts.append(f"You only have {liters_remaining:.1f}L remaining, which is below your reserve.")
            elif planned_trip_km and planned_trip_km > range_km:
                parts.append(
                    f"Your planned trip of {planned_trip_km:.0f} km exceeds your current range of {range_km:.0f} km."
                )
            else:
                parts.append("Your fuel level is critically low.")
            parts.append("Fill up now to avoid running out of fuel.")

        elif severity == "medium":
            if planned_trip_km and planned_trip_km > 0.7 * range_km:
                parts.append(
                    f"Your planned trip of {planned_trip_km:.0f} km will use most of your remaining range ({range_km:.0f} km)."
                )
                parts.append("Consider filling up before your trip.")
            elif price_trend == "rising":
                if price_delta and today_price:
                    parts.append(
                        f"Gas prices are expected to rise by {abs(price_delta) * 100:.1f}¢/L."
                    )
                else:
                    parts.append("Gas prices are trending upward.")
                parts.append(f"With {range_km:.0f} km of range, filling up now could save you money.")
            else:
                parts.append("Consider filling up soon based on your current fuel level and usage patterns.")

        else:
            parts.append("You may want to fill up, but it's not urgent.")

    else:  # NO_ACTION
        parts.append(f"You have approximately {range_km:.0f} km of range remaining.")

        if price_trend == "falling" and price_delta:
            parts.append(
                f"Prices are expected to drop by {abs(price_delta) * 100:.1f}¢/L, so waiting could save you money."
            )
        elif price_trend == "flat":
            parts.append("Prices are stable, so there's no urgency to fill up.")
        else:
            parts.append("No immediate action needed.")

    return " ".join(parts)

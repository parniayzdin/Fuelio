import { useState, useEffect, useCallback } from "react";
import { getPriceForecast, getRegions } from "@/api/endpoints";
import type { PriceForecast, Region, PricePoint } from "@/types";

//generated a simple mock forecast for a region (NEED ACTUAL DATA LATER)
function generateMockForecast(regionId: string, regionName: string): PriceForecast {
  const today = new Date();
  const prices: PricePoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    //set date to i days ago
    date.setDate(date.getDate() - i);
    const basePrice = 1.35 + Math.random() * 0.15;
    prices.push({
      date: date.toISOString().split("T")[0],
      price: Number(basePrice.toFixed(3)),
      is_forecast: false,
    });
  }

  //Generate 7 days of forecast data
  const lastPrice = prices[prices.length - 1].price;
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const trend = Math.random() > 0.5 ? 0.02 : -0.02;
    const forecastPrice = lastPrice + trend * i + (Math.random() - 0.5) * 0.05;
    prices.push({
      date: date.toISOString().split("T")[0],
      price: Number(Math.max(1.2, forecastPrice).toFixed(3)),
      is_forecast: true,
    });
  }

  const historicalPrices = prices.filter(p => !p.is_forecast).map(p => p.price);
  const forecastPrices = prices.filter(p => p.is_forecast).map(p => p.price);
  const avgHistorical = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
  const avgForecast = forecastPrices.reduce((a, b) => a + b, 0) / forecastPrices.length;

  let trend: "rising" | "falling" | "stable" = "stable";
  if (avgForecast > avgHistorical * 1.02) trend = "rising";
  else if (avgForecast < avgHistorical * 0.98) trend = "falling";

  return {
    region_id: regionId,
    region_name: regionName,
    currency: "$",
    unit: "L",
    prices,
    trend,
    forecast_confidence: 0.75 + Math.random() * 0.2,
  };
}

export function usePriceForecast() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [forecast, setForecast] = useState<PriceForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    async function loadRegions() {
      try {
        const data = await getRegions();
        setRegions(data);
        if (data.length > 0) {
          setSelectedRegion(data[0].id);
        }
      } catch (err) {
        console.warn("Failed to load regions, using mock data:", err);
        const mockRegions: Region[] = [
          { id: "us-ca", name: "California", country: "USA" },
          { id: "us-tx", name: "Texas", country: "USA" },
          { id: "us-ny", name: "New York", country: "USA" },
          { id: "ca-on", name: "Ontario", country: "Canada" },
          { id: "ca-bc", name: "British Columbia", country: "Canada" },
        ];
        setRegions(mockRegions);
        setSelectedRegion(mockRegions[0].id);
        setUseMockData(true);
      }
    }
    loadRegions();
  }, []);

  const loadForecast = useCallback(async () => {
    if (!selectedRegion) return;

    //I believe the UI relies on `error` to show a message, but I don't think it will ever show.
    setIsLoading(true);
    setError(null);

    try {
      if (useMockData) {
        const region = regions.find(r => r.id === selectedRegion);
        const mockForecast = generateMockForecast(selectedRegion, region?.name || "Unknown");
        setForecast(mockForecast);
      } else {
        const data = await getPriceForecast(selectedRegion);
        setForecast(data);
      }
    } catch (err) {
      console.error("Failed to load forecast:", err);
      // Show error instead of silently falling back to mock data
      setError("Failed to load price forecast data. Please try again later.");
      // Only use mock data in development mode as fallback
      if (import.meta.env.DEV) {
        const region = regions.find(r => r.id === selectedRegion);
        const mockForecast = generateMockForecast(selectedRegion, region?.name || "Unknown");
        setForecast(mockForecast);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedRegion, useMockData, regions]);

  //This can lead to double fetches. Not a bug in prod, but confusing in dev
  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  return {
    regions,
    selectedRegion,
    setSelectedRegion,
    forecast,
    isLoading,
    error,
    refetch: loadForecast,
  };
}

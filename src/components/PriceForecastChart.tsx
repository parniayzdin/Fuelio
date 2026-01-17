import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { PricePoint } from "@/types";

interface PriceForecastChartProps {
  prices: PricePoint[];
  currency: string;
  unit: string;
}

export function PriceForecastChart({ prices, currency, unit }: PriceForecastChartProps) {
  const chartData = useMemo(() => {
    return prices.map((point) => ({
      date: point.date,
      formattedDate: format(parseISO(point.date), "MMM d"),
      price: point.price,
      historical: point.is_forecast ? null : point.price,
      forecast: point.is_forecast ? point.price : null,
      isForecast: point.is_forecast,
    }));
  }, [prices]);

  const transitionIndex = useMemo(() => {
    return chartData.findIndex((d) => d.isForecast);
  }, [chartData]);

  const lastHistoricalPrice = transitionIndex > 0
    ? chartData[transitionIndex - 1]?.price
    : null;

  const dataWithBridge = useMemo(() => {
    if (transitionIndex <= 0) return chartData;

    return chartData.map((point, index) => {
      if (index === transitionIndex - 1) {
        return {
          ...point,
          forecast: point.price,
        };
      }
      return point;
    });
  }, [chartData, transitionIndex]);

  const transitionDate = transitionIndex > 0
    ? chartData[transitionIndex]?.date
    : null;

  const minPrice = prices.length > 0 ? Math.min(...prices.map((p) => p.price)) * 0.95 : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices.map((p) => p.price)) * 1.05 : 10;

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dataWithBridge} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />

          <XAxis
            dataKey="formattedDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            dy={10}
          />

          <YAxis
            domain={[minPrice, maxPrice]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickFormatter={(value) => `${currency}${value.toFixed(2)}`}
            dx={-10}
          />

          {transitionDate && (
            <ReferenceLine
              x={format(parseISO(transitionDate), "MMM d")}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              label={{
                value: "Today",
                position: "top",
                fill: "#6b7280",
                fontSize: 11,
              }}
            />
          )}

          {/* Historical area */}
          <Area
            type="monotone"
            dataKey="historical"
            stroke="#16a34a"
            strokeWidth={2}
            fill="url(#historicalGradient)"
            connectNulls={false}
            dot={false}
            activeDot={{
              r: 6,
              fill: "#16a34a",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
          />

          {/* Forecast area */}
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="url(#forecastGradient)"
            connectNulls={false}
            dot={false}
            activeDot={{
              r: 6,
              fill: "#2563eb",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              const price = data.historical ?? data.forecast;

              return (
                <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(data.date), "EEEE, MMM d, yyyy")}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {currency}{price?.toFixed(3)} / {unit}
                  </p>
                  <p className={`text-xs mt-1 ${data.isForecast ? 'text-chart-forecast' : 'text-chart-historical'}`}>
                    {data.isForecast ? "Forecast" : "Historical"}
                  </p>
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

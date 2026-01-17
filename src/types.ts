// Auth types
export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user?: User;
}

// Vehicle types
export interface Vehicle {
  tank_size_liters: number;
  efficiency_l_per_100km: number;
  reserve_fraction: number;
  default_region_id: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  image_url?: string | null;
}

// Trip types
export interface Trip {
  id: string;
  start_time: string;
  end_time: string;
  distance_km: number;
  created_at?: string;
}

export interface CreateTripRequest {
  start_time: string;
  end_time: string;
  distance_km: number;
}

// Fill-up types
export interface Fillup {
  id: string;
  timestamp?: string;
  time?: string;
  full_tank?: boolean;
  full_tank_bool?: boolean;
  fuel_percent?: number;
  fuel_percent_optional?: number;
  liters?: number;
  liters_optional?: number;
  created_at?: string;
}

export interface CreateFillupRequest {
  timestamp?: string;
  time?: string;
  full_tank?: boolean;
  full_tank_bool?: boolean;
  fuel_percent?: number;
  fuel_percent_optional?: number;
  liters?: number;
  liters_optional?: number;
}

// Price types
export interface Region {
  id: string;
  name: string;
  country?: "USA" | "Canada";
}

export interface PricePoint {
  date: string;
  price: number;
  is_forecast: boolean;
}

export interface PriceForecast {
  region_id: string;
  region_name: string;
  currency: string;
  unit: string;
  prices: PricePoint[];
  trend: "rising" | "falling" | "stable";
  forecast_confidence: number;
}

// Decision types
export type FuelAnchor =
  | { type: "percent"; percent: number }
  | { type: "last_full_fillup_date"; date: string };

export interface EvaluateRequest {
  region_id: string;
  fuel_anchor_type?: "percent" | "last_full_fillup_date";
  fuel_percent?: number;
  last_fillup_date?: string;
  fuel_anchor: FuelAnchor;
  planned_trip_km?: number;
  use_predicted_trip?: boolean;
}

export interface Evidence {
  liters_remaining?: number;
  range_km: number;
  reserve_fraction: number;
  planned_trip_km?: number;
  today_price?: number;
  predicted_tomorrow?: number;
  price_delta?: number;
  price_trend?: "rising" | "flat" | "falling";
}

export interface DecisionResponse {
  decision: "FILL" | "NO_ACTION";
  severity: "low" | "medium" | "high";
  explanation: string;
  current_price?: number;
  predicted_price?: number;
  price_change_percent?: number;
  confidence: number;
  evidence: Evidence;
}

// AI types
export interface TripGuess {
  predicted_km?: number;
  confidence?: number;
  probability_trip_next_24h: number;
  expected_trip_distance_km: number;
}

// Alert types (local storage)
export interface Alert {
  id: string;
  date: string;
  decision: "FILL" | "NO_ACTION";
  severity: "low" | "medium" | "high";
  explanation: string;
  status: "new" | "acknowledged" | "read";
}

export interface User {
  id: string;
  email: string;
  tos_accepted_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Vehicle {
  tank_size_liters: number;
  efficiency_l_per_100km: number;
  reserve_fraction: number;
  default_region_id: string | null;
  make?: string;
  model?: string;
  year?: number;
  image_url?: string;
  fuel_type?: "regular" | "premium" | "diesel" | "electric";
}

export interface Trip {
  id: string;
  start_time: string;
  end_time?: string;
  distance_km?: number;
  start_location_lat?: number;
  start_location_lng?: number;
  end_location_lat?: number;
  end_location_lng?: number;
  start_address?: string;
  end_address?: string;
  created_at?: string;
}

export interface CreateTripRequest {
  start_time?: string;
  end_time?: string;
  distance_km?: number;
  start_location_lat?: number;
  start_location_lng?: number;
  end_location_lat?: number;
  end_location_lng?: number;
}

export interface Fillup {
  id: string;
  timestamp: string;
  full_tank: boolean;
  fuel_percent?: number;
  liters: number;
  created_at: string;
}

export interface CreateFillupRequest {
  timestamp: string;
  full_tank: boolean;
  fuel_percent?: number;
  liters: number;
}

export interface Region {
  id: string;
  name: string;
  country: "USA" | "Canada";
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

export interface EvaluateRequest {
  region_id: string;
  fuel_anchor_type: "percent" | "last_full_fillup_date";
  fuel_percent?: number;
  last_fillup_date?: string;
  planned_trip_km?: number;
}

export interface DecisionResponse {
  decision: "FILL" | "NO_ACTION";
  severity: "low" | "medium" | "high";
  explanation: string;
  current_price: number;
  predicted_price: number;
  price_change_percent: number;
}

export interface TripGuess {
  predicted_km: number;
  confidence: number;
}

export interface Alert {
  id: string;
  date: string;
  decision: "FILL" | "NO_ACTION";
  severity: "low" | "medium" | "high";
  explanation: string;
  status: "new" | "read";
}

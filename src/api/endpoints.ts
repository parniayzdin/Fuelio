import { apiGet, apiPost, apiPut, apiDelete, setToken, getToken } from "./client";
import type {
  User,
  AuthResponse,
  Vehicle,
  Trip,
  CreateTripRequest,
  Fillup,
  CreateFillupRequest,
  Region,
  EvaluateRequest,
  DecisionResponse,
  TripGuess,
  Alert,
  PriceForecast,
  PricePoint,
  CreditCard,
  CreateCreditCardRequest,
} from "@/types";


// Auth endpoints
export async function signup(email: string, password: string, lat?: number, lng?: number): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>("/auth/signup", { email, password, lat, lng });
  setToken(response.token);
  return response;
}

export async function login(email: string, password: string, lat?: number, lng?: number): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>("/auth/login", { email, password, lat, lng });
  setToken(response.token);
  return response;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>("/auth/google", { id_token: idToken });
  setToken(response.token);
  return response;
}

export async function acceptTerms(): Promise<void> {
  return apiPost<void>("/auth/terms/accept", {});
}

export async function getMe(): Promise<User> {
  return apiGet<User>("/me");
}

// Vehicle endpoints
export async function getVehicle(): Promise<Vehicle> {
  return apiGet<Vehicle>("/vehicle");
}

export async function updateVehicle(vehicle: Vehicle): Promise<Vehicle> {
  return apiPut<Vehicle>("/vehicle", vehicle);
}

// Trip endpoints
export async function getTrips(): Promise<Trip[]> {
  return apiGet<Trip[]>("/trips");
}

export async function createTrip(trip: CreateTripRequest): Promise<Trip> {
  return apiPost<Trip>("/trips", trip);
}

export async function deleteTrip(id: string): Promise<void> {
  return apiDelete<void>(`/trips/${id}`);
}

export async function deleteAllTrips(): Promise<void> {
  return apiDelete<void>("/trips");
}

export async function importTimeline(file: File): Promise<{ status: string; imported: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ''}/trips/import-timeline`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to import timeline');
  }

  return response.json();
}

export interface TripRecommendation {
  recommendation: string;
  reasoning: string;
  estimated_savings: number;
  next_trip_details: {
    distance_km: number;
    start_time: string;
    hours_until: number;
  } | null;
  confidence: string;
  optimization_status?: string;
}

export async function getTripRecommendation(): Promise<TripRecommendation> {
  return apiGet<TripRecommendation>("/trip-recommendation");
}

// Fill-up endpoints
export async function getFillups(): Promise<Fillup[]> {
  return apiGet<Fillup[]>("/fillups");
}

export async function createFillup(fillup: CreateFillupRequest): Promise<Fillup> {
  return apiPost<Fillup>("/fillups", fillup);
}

export interface ReceiptUploadResponse {
  success: boolean;
  extracted_data: {
    price_per_liter: number | null;
    total_amount: number | null;
    liters: number | null;
    date: string | null;
    time: string | null;
    raw_text: string;
  };
  fillup_created: boolean;
  fillup_id: string | null;
}

export async function uploadReceipt(file: File): Promise<ReceiptUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/fillups/upload-receipt`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload receipt');
  }

  return response.json();
}

// Price endpoints
export async function getRegions(): Promise<Region[]> {
  return apiGet<Region[]>("/prices/regions");
}

interface BackendPrice {
  day: string;
  avg_price_per_liter: number;
}

interface BackendForecast {
  day: string;
  predicted_price: number;
  delta_from_today: number;
  trend: "rising" | "flat" | "falling";
}

export async function getPriceHistory(regionId: string, days: number = 30): Promise<PricePoint[]> {
  const data = await apiGet<BackendPrice[]>(`/prices/${encodeURIComponent(regionId)}/series?days=${days}`);
  return data.map(p => ({
    date: p.day,
    price: p.avg_price_per_liter,
    is_forecast: false
  }));
}

export async function getPriceForecast(regionId: string, days: number = 7): Promise<PricePoint[]> {
  const data = await apiGet<BackendForecast[]>(`/prices/${encodeURIComponent(regionId)}/forecast?days=${days}`);
  return data.map(f => ({
    date: f.day,
    price: f.predicted_price,
    is_forecast: true
  }));
}

export async function refreshRealPrices(): Promise<{ status: string; updated: Record<string, number | null> }> {
  return apiPost("/prices/refresh", {});
}

// Decision endpoints
export async function evaluateDecision(request: EvaluateRequest): Promise<DecisionResponse> {
  return apiPost<DecisionResponse>("/decision/evaluate", request);
}

// AI endpoints
export async function getTripGuess(regionId: string): Promise<TripGuess> {
  return apiGet<TripGuess>(`/ai/trip-guess?region_id=${encodeURIComponent(regionId)}`);
}

// Alert endpoints
export async function getAlerts(): Promise<Alert[]> {
  return apiGet<Alert[]>("/alerts");
}

// News Analysis endpoints
export interface NewsSource {
  title: string;
  url: string;
  date: string;
  snippet: string;
  publisher: string;
}

export interface NewsAnalysis {
  prediction: "rising" | "falling" | "stable";
  confidence: number;
  summary: string;
  reasoning: string;
  sources: NewsSource[];
  last_updated: string;
}

export async function getNewsAnalysis(region: string): Promise<NewsAnalysis> {
  return apiGet<NewsAnalysis>(`/news/analysis?region=${encodeURIComponent(region)}`);
}

// Gas Stations endpoints
export interface GasStationResponse {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  address: string;
  regular: number | null;
  premium: number | null;
  diesel: number | null;
  lastUpdated: string;
  place_id?: string;
  rating?: number;
  user_ratings_total?: number;
}

export async function getGasStations(
  lat: number,
  lng: number,
  radius: number = 5000
): Promise<GasStationResponse[]> {
  return apiGet<GasStationResponse[]>(
    `/gas-stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
  );
}

// Credit Card endpoints
export async function getCreditCardProviders(): Promise<string[]> {
  return apiGet<string[]>("/credit-cards/providers");
}

export async function getCreditCards(): Promise<CreditCard[]> {
  return apiGet<CreditCard[]>("/credit-cards");
}

export async function addCreditCard(provider: string): Promise<CreditCard> {
  const request: CreateCreditCardRequest = { provider };
  return apiPost<CreditCard>("/credit-cards", request);
}

export async function deleteCreditCard(id: string): Promise<void> {
  return apiDelete<void>(`/credit-cards/${id}`);
}

export async function refreshCardBenefits(id: string): Promise<CreditCard> {
  return apiPost<CreditCard>(`/credit-cards/${id}/refresh`, {});
}

// Optimal Gas Station endpoints
export interface StationRecommendation {
  station: GasStationResponse;
  distance_km: number;
  fuel_cost_to_drive: number;
  base_price_per_liter: number;
  effective_price_per_liter: number;  // After cashback
  total_cost_for_tank: number;
  savings_vs_average: number;
  rank: number;
  reasoning: string;
  best_card_to_use?: string;
  card_savings: number;
}

export interface CardRecommendation {
  card_name: string;
  potential_savings_per_fill: number;
  best_station_with_card: string;
  effective_price_with_card: number;
  why_recommended: string;
}

export interface OptimalStationResponse {
  optimal: StationRecommendation;
  alternatives: StationRecommendation[];
  analysis_summary: string;
  card_recommendations: CardRecommendation[];
  your_cards_used: string[];
}

export async function getOptimalGasStation(
  lat: number,
  lng: number,
  tankSizeLiters: number = 50,
  efficiencyLPer100km: number = 8,
  currentFuelPercent: number = 20,
  radius: number = 10000
): Promise<OptimalStationResponse> {
  return apiGet<OptimalStationResponse>(
    `/gas-stations/optimal?lat=${lat}&lng=${lng}&tank_size_liters=${tankSizeLiters}&efficiency_l_per_100km=${efficiencyLPer100km}&current_fuel_percent=${currentFuelPercent}&radius=${radius}`
  );
}

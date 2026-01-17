import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { Lightbulb, Car as CarIcon, CreditCard as CreditCardIcon, X, RefreshCw, Loader2, Navigation, Fuel } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DecisionBadge } from "@/components/DecisionBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { AdBanner } from "@/components/promotions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { getRegions, evaluateDecision, getTripGuess, getVehicle, updateVehicle, getTripRecommendation, type TripRecommendation, getCreditCards, getCreditCardProviders, addCreditCard, deleteCreditCard, refreshCardBenefits, getOptimalGasStation, type OptimalStationResponse, getTrips } from "@/api/endpoints";
import type { Region, DecisionResponse, TripGuess, EvaluateRequest, Alert, Vehicle, PricePoint, CreditCard, Trip } from "@/types";

interface EvaluateFormData {
  region_id: string;
  fuel_anchor_type: "percent" | "last_full_fillup_date";
  fuel_percent: number;
  last_fillup_date: Date | undefined;
  planned_trip_km: string;
  use_predicted_trip: boolean;
}

interface FillupFormData {
  date: Date;
  time: string;
  full_tank: boolean;
  fuel_percent: string;
  liters: string;
}


interface VehicleFormData {
  make: string;
  model: string;
  year: string;
  efficiency_l_per_100km: string;
  fuel_type: string;
  image_url?: string;
}

export function Dashboard() {
  // Persisted fuel percent across navigation
  const savedFuelPercent = (() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('fuel_percent') : null;
    const n = v !== null ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
  })();
  const [regions, setRegions] = useState<Region[]>([]);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [tripGuess, setTripGuess] = useState<TripGuess | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [thisWeekKm, setThisWeekKm] = useState<number>(0);
  const [nextWeekKm, setNextWeekKm] = useState<number>(0);
  const [predictedNextWeekLiters, setPredictedNextWeekLiters] = useState<number>(0);
  const [tripRecommendation, setTripRecommendation] = useState<TripRecommendation | null>(null);
  

  // Credit Card state
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [creditCardProviders, setCreditCardProviders] = useState<string[]>([]);
  const [creditCardDialogOpen, setCreditCardDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [addingCard, setAddingCard] = useState(false);
  const [refreshingCardId, setRefreshingCardId] = useState<string | null>(null);

  // Optimal Gas Station state
  const [optimalStation, setOptimalStation] = useState<OptimalStationResponse | null>(null);
  const [loadingOptimalStation, setLoadingOptimalStation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm<EvaluateFormData>({
    defaultValues: {
      region_id: "",
      fuel_anchor_type: "percent",
      fuel_percent: savedFuelPercent,
      last_fillup_date: undefined,
      planned_trip_km: "",
      use_predicted_trip: false,
    },
  });

  const {
    control: vehicleControl,
    handleSubmit: handleVehicleSubmit,
    reset: resetVehicle,
    setValue: setVehicleFormValue,
  } = useForm<VehicleFormData>({
    defaultValues: {
      make: "",
      model: "",
      year: "",
      efficiency_l_per_100km: "",
      fuel_type: "regular",
    }
  })

  const watchedRegion = watch("region_id");
  const watchedUsePredicted = watch("use_predicted_trip");
  const watchedFuelAnchorType = watch("fuel_anchor_type");
  const watchedFuelPercent = watch("fuel_percent");

  // Persist fuel percent so it doesn't reset on navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof watchedFuelPercent === 'number') {
      window.localStorage.setItem('fuel_percent', String(watchedFuelPercent));
    }
  }, [watchedFuelPercent]);
  useEffect(() => {
    getRegions()
      .then((data) => {
        setRegions(data);
        if (data.length > 0) {
          setValue("region_id", data[0].id);
        }
      })
      .catch(console.error);
  }, [setValue]);

  useEffect(() => {
    if (watchedRegion && watchedUsePredicted) {
      getTripGuess(watchedRegion)
        .then(setTripGuess)
        .catch(() => setTripGuess(null));
    }
  }, [watchedRegion, watchedUsePredicted]);

  useEffect(() => {
    getVehicle().then(v => {
      setVehicle(v);
      if (v.make) setVehicleFormValue("make", v.make);
      if (v.model) setVehicleFormValue("model", v.model);
      if (v.year) setVehicleFormValue("year", v.year.toString());
      if (v.efficiency_l_per_100km) setVehicleFormValue("efficiency_l_per_100km", v.efficiency_l_per_100km.toString());
      if (v.fuel_type) setVehicleFormValue("fuel_type", v.fuel_type);
    }).catch(console.error);
  }, [setVehicleFormValue]);

  

  useEffect(() => {
    getTrips().then(setTrips).catch(console.error);
    getTripRecommendation()
      .then(setTripRecommendation)
      .catch(err => {
        console.error("Failed to load trip recommendations:", err);
        // Fallback to NO_TRIPS so user can use manual planner
        setTripRecommendation({
          recommendation: 'NO_TRIPS',
          reasoning: 'Could not load upcoming trips.',
          estimated_savings: 0,
          confidence: 'N/A',
          next_trip_details: null
        });
      });

    // Load credit cards and providers
    getCreditCards().then(setCreditCards).catch(console.error);
    getCreditCardProviders().then(setCreditCardProviders).catch(console.error);

    // Get user location for optimal gas station
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          // Default to Toronto if geolocation fails
          setUserLocation({ lat: 43.65, lng: -79.38 });
        }
      );
    }
  }, []);

  // Compute weekly trip metrics and predicted consumption
  useEffect(() => {
    const now = new Date();
    const sow = startOfWeek(now, { weekStartsOn: 1 });
    const eow = endOfWeek(now, { weekStartsOn: 1 });
    const nextSow = addWeeks(sow, 1);
    const nextEow = endOfWeek(nextSow, { weekStartsOn: 1 });
    const lastSow = addWeeks(sow, -1);
    const lastEow = endOfWeek(lastSow, { weekStartsOn: 1 });

    const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;

    const thisWeek = trips.filter(t => inRange(new Date(t.start_time), sow, now));
    const nextWeek = trips.filter(t => inRange(new Date(t.start_time), nextSow, nextEow));
    const lastWeek = trips.filter(t => inRange(new Date(t.start_time), lastSow, lastEow));

    const sumKm = (list: Trip[]) => list.reduce((acc, t) => acc + (t.distance_km || 0), 0);
    const thisKm = sumKm(thisWeek);
    const nextKm = sumKm(nextWeek);
    const lastKm = sumKm(lastWeek);

    setThisWeekKm(thisKm);
    setNextWeekKm(nextKm);

    const eff = vehicle?.efficiency_l_per_100km || 8;
    setPredictedNextWeekLiters((lastKm * eff) / 100);
  }, [trips, vehicle]);

  // Fetch optimal station when location and vehicle are available
  const fetchOptimalStation = async () => {
    if (!userLocation) return;

    setLoadingOptimalStation(true);
    try {
      const tankSize = vehicle?.tank_size_liters || 50;
      const efficiency = vehicle?.efficiency_l_per_100km || 8;
      const result = await getOptimalGasStation(
        userLocation.lat,
        userLocation.lng,
        tankSize,
        efficiency,
        (watchedFuelPercent ?? 50),
        10000
      );
      setOptimalStation(result);
    } catch (error) {
      console.error("Failed to fetch optimal station:", error);
    } finally {
      setLoadingOptimalStation(false);
    }
  };

  // Auto-fetch when location becomes available
  useEffect(() => {
    if (userLocation) {
      fetchOptimalStation();
    }
  }, [userLocation, vehicle, watchedFuelPercent]);

  const onAddCreditCard = async () => {
    if (!selectedProvider) return;

    setAddingCard(true);
    try {
      const newCard = await addCreditCard(selectedProvider);
      setCreditCards(prev => [...prev, newCard]);
      setCreditCardDialogOpen(false);
      setSelectedProvider("");
    } catch (error) {
      console.error("Failed to add credit card:", error);
    } finally {
      setAddingCard(false);
    }
  };

  const onDeleteCreditCard = async (id: string) => {
    try {
      await deleteCreditCard(id);
      setCreditCards(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Failed to delete credit card:", error);
    }
  };

  const onRefreshCardBenefits = async (id: string) => {
    setRefreshingCardId(id);
    try {
      const updated = await refreshCardBenefits(id);
      setCreditCards(prev => prev.map(c => c.id === id ? updated : c));
    } catch (error) {
      console.error("Failed to refresh benefits:", error);
    } finally {
      setRefreshingCardId(null);
    }
  };

  const onSaveVehicle = async (data: VehicleFormData) => {
    setIsSavingVehicle(true);
    try {
      // Image is now handled by backend fetching from Google Custom Search
      // We pass undefined/empty image_url for backend to fill if needed
      const imageUrl = data.image_url;

      // Construct payload safely, handling the case where 'vehicle' is null (first time user)
      const baseVehicle = vehicle || {
        tank_size_liters: 70, // Reasonable default
        efficiency_l_per_100km: 9.0, // Reasonable default
        reserve_fraction: 0.1,
        default_region_id: regions[0]?.id || ""
      };

      const updated = await updateVehicle({
        ...baseVehicle,
        make: data.make,
        model: data.model,
        year: parseInt(data.year) || 2020,
        efficiency_l_per_100km: parseFloat(data.efficiency_l_per_100km) || 0,
        fuel_type: data.fuel_type as "regular" | "premium" | "diesel" | "electric",
        image_url: "" // Force backend to generate fresh image using new strict whitelist
      });
      setVehicle(updated);
      setVehicleDialogOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const onEvaluate = async (data: EvaluateFormData) => {
    setIsEvaluating(true);
    try {
      const request: EvaluateRequest = {
        region_id: data.region_id,
        fuel_anchor_type: data.fuel_anchor_type,
        fuel_percent: data.fuel_anchor_type === "percent" ? data.fuel_percent : undefined,
        last_fillup_date: data.fuel_anchor_type === "last_full_fillup_date" && data.last_fillup_date
          ? data.last_fillup_date.toISOString()
          : undefined,
        fuel_anchor: data.fuel_anchor_type === "percent"
          ? { type: "percent", percent: data.fuel_percent }
          : { type: "last_full_fillup_date", date: data.last_fillup_date?.toISOString() || new Date().toISOString() },
        planned_trip_km: data.use_predicted_trip && tripGuess
          ? tripGuess.predicted_km
          : data.planned_trip_km
            ? parseFloat(data.planned_trip_km)
            : undefined,
      };

      const result = await evaluateDecision(request);
      setDecision(result);

      // Save to alerts
      const alert: Alert = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        decision: result.decision,
        severity: result.severity,
        explanation: result.explanation,
        status: "new",
      };
      const existingAlerts = JSON.parse(localStorage.getItem("alerts") || "[]");
      localStorage.setItem("alerts", JSON.stringify([alert, ...existingAlerts]));
    } catch (error) {
      console.error("Failed to evaluate:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  

  

  // Calculate range remaining (exclude reserve fuel)
  const reserveFraction = vehicle?.reserve_fraction ?? 0.1;
  const fuelPercentVal = watchedFuelPercent;
  const rangeRemaining = (
    vehicle && watchedFuelAnchorType === 'percent' &&
    typeof fuelPercentVal === 'number' &&
    vehicle.efficiency_l_per_100km > 0
  )
    ? ((vehicle.tank_size_liters * Math.max(0, (fuelPercentVal / 100) - reserveFraction)) / vehicle.efficiency_l_per_100km) * 100
    : null;

  return (
    <Layout>
      <div className="space-y-8">

        {/* Top Row: Vehicle + Range */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Card 1: Vehicle Configuration */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CarIcon className="h-4 w-4" />
                  Vehicle Configuration
                </CardTitle>
                <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">Edit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Vehicle Details</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleVehicleSubmit(onSaveVehicle)} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Make</Label>
                        <Controller name="make" control={vehicleControl} render={({ field }) => <Input placeholder="e.g. Jeep" {...field} />} />
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Controller name="model" control={vehicleControl} render={({ field }) => <Input placeholder="e.g. Cherokee" {...field} />} />
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Controller name="year" control={vehicleControl} render={({ field }) => <Input type="number" placeholder="e.g. 2023" {...field} />} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fuel Efficiency (L/100km)</Label>
                        <Controller
                          name="efficiency_l_per_100km"
                          control={vehicleControl}
                          render={({ field }) => (
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="e.g. 9.5 (Leave blank to auto-detect)"
                              {...field}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fuel Type</Label>
                        <Controller
                          name="fuel_type"
                          control={vehicleControl}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select fuel type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular">Regular (87)</SelectItem>
                                <SelectItem value="premium">Premium (91+)</SelectItem>
                                <SelectItem value="diesel">Diesel</SelectItem>
                                <SelectItem value="electric">Electric</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <Button type="submit" disabled={isSavingVehicle} className="w-full">
                        {isSavingVehicle ? "Saving..." : "Save Vehicle"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {vehicle?.make ? (
                <div className="space-y-4">
                  {vehicle.image_url && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-md">
                      <img src={vehicle.image_url} alt="Vehicle" className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                    <span className="font-semibold">{vehicle.efficiency_l_per_100km} L/100km</span>
                  </div>
                  {/* Max range (usable, excluding reserve) */}
                  {vehicle?.efficiency_l_per_100km && vehicle.efficiency_l_per_100km > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Max range (usable): </span>
                      <span className="font-semibold">
                        {Math.round(((vehicle.tank_size_liters * (1 - (vehicle.reserve_fraction ?? 0.1))) / vehicle.efficiency_l_per_100km) * 100)} km
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No vehicle configured</p>
                  <Button variant="link" onClick={() => setVehicleDialogOpen(true)}>Add Vehicle</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Range Remaining */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Range Remaining</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {rangeRemaining !== null ? `${rangeRemaining.toFixed(0)} km` : 'N/A'}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fuel Level</span>
                  <span className="font-medium">{watchedFuelPercent}%</span>
                </div>
                <Controller
                  name="fuel_percent"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      max={100}
                      step={5}
                    />
                  )}
                />
                {vehicle && (
                  <div className="text-xs text-muted-foreground">
                    Based on your vehicle: tank {vehicle.tank_size_liters}L • eff {vehicle.efficiency_l_per_100km} L/100km • reserve {(reserveFraction * 100).toFixed(0)}%
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-muted/30 p-2 rounded">
                    <div className="text-xs text-muted-foreground">Driven this week</div>
                    <div className="font-semibold">{Math.round(thisWeekKm)} km</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <div className="text-xs text-muted-foreground">Planned next week</div>
                    <div className="font-semibold">{Math.round(nextWeekKm)} km</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <div className="text-xs text-muted-foreground">Predicted consumption</div>
                    <div className="font-semibold">{predictedNextWeekLiters.toFixed(1)} L</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          
        </div>

        {/* Middle Row: AI Strategy Hero */}
        <Card className="border-2 border-primary/20 bg-gradient-to-b from-background to-primary/5 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">AI Fuel Strategy</CardTitle>
                  <CardDescription>Personalized recommendation based on your trips & market data</CardDescription>
                </div>
              </div>

              {tripRecommendation && tripRecommendation.confidence && tripRecommendation.confidence !== 'N/A' && (
                <div className={cn(
                  "px-3 py-1 rounded-full text-sm font-semibold border",
                  tripRecommendation.confidence === 'HIGH' ? "bg-green-50 text-green-700 border-green-200" :
                    tripRecommendation.confidence === 'MEDIUM' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                      "bg-gray-50 text-gray-700 border-gray-200"
                )}>
                  {tripRecommendation.confidence} Confidence
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!tripRecommendation ? (
              <div className="py-8 text-center text-muted-foreground animate-pulse">
                Analyzing optimization models...
              </div>
            ) : tripRecommendation.recommendation === 'NO_TRIPS' ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                  <p className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    🧠 Pyomo Mathematical Optimization
                  </p>
                  <p className="text-xs mt-1">Uses operations research to find when & where to fill up based on:</p>
                  <ul className="text-xs mt-2 grid grid-cols-2 gap-1">
                    <li>• Gas stations along route (20km)</li>
                    <li>• 7-day price forecasts</li>
                    <li>• Your credit card cashback</li>
                    <li>• Vehicle consumption model</li>
                  </ul>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <p className="text-sm font-medium">Try a Demo Trip: Toronto → London, ON</p>
                  <div className="space-y-4 pt-4">
                {/* Range Remaining slider removed; uses top control */}
                  </div>

                  <Button
                    className="w-full mt-4"
                    onClick={async () => {
                      try {
                        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                        const res = await fetch(`${API_BASE}/fuel-strategy/optimize`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            trip_path: [
                              { lat: 43.65, lng: -79.38 },
                              { lat: 43.26, lng: -79.87 },
                              { lat: 42.98, lng: -81.23 }
                            ],
                            tank_size_liters: vehicle?.tank_size_liters || 50,
                            efficiency_l_per_100km: vehicle?.efficiency_l_per_100km || 8,
                            current_fuel_percent: (watch("fuel_percent") ?? 50),
                            search_radius_km: 20
                          })
                        });
                        const data = await res.json();

                        // Check for solver error since we enforce strict CPLEX now
                        if (data.solver_status && data.solver_status.startsWith('error')) {
                          alert(`Optimization Error: ${data.solver_status}\n\n${data.reasoning?.join('\n')}`);
                          return;
                        }

                        setTripRecommendation({
                          recommendation: 'OPTIMIZED', // Custom state for demo result
                          reasoning: data.reasoning?.join('\n') || 'Optimized route calculated.',
                          estimated_savings: data.total_savings || 0,
                          confidence: 'HIGH',
                          next_trip_details: {
                            distance_km: data.stops?.length ? data.stops.reduce((acc: number, s: any) => acc + (s.km_at_stop || 0), 0) : 180, // Approx for demo
                            start_time: new Date().toISOString(),
                            hours_until: 0
                          },
                          optimization_status: data.solver_status
                        });
                      } catch (e) {
                        console.error('Optimization error:', e);
                        alert('Optimization failed - make sure server is running');
                      }
                    }}
                  >
                    <Fuel className="h-4 w-4 mr-2" />
                    Run AI Fuel Optimization
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Or plan a trip on the Gas Map for personalized recommendations
                </p>
              </div>
            ) : tripRecommendation.recommendation === 'NO_VEHICLE' ? (
              <div className="py-8 text-center">
                <CarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-medium text-foreground">Vehicle Setup Required</h3>
                <p className="text-muted-foreground">Configure your vehicle details below to enable fuel optimization.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="text-center md:text-left space-y-4">
                  <div className={cn(
                    "inline-block px-6 py-3 rounded-xl text-2xl font-bold shadow-sm",
                    tripRecommendation.recommendation === 'FILL_NOW' ? "bg-green-100 text-green-800 border border-green-200" :
                      tripRecommendation.recommendation === 'WAIT' ? "bg-blue-100 text-blue-800 border border-blue-200" :
                        "bg-yellow-100 text-yellow-800 border border-yellow-200"
                  )}>
                    {tripRecommendation.recommendation.replace(/_/g, ' ')}
                  </div>
                  <p className="text-lg text-foreground/80 leading-relaxed">
                    {tripRecommendation.reasoning}
                  </p>
                </div>

                <div className="space-y-4 bg-background/50 p-4 rounded-xl border">
                  {tripRecommendation.estimated_savings > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Potential Savings</span>
                      <span className="text-lg font-bold text-green-600">
                        ${tripRecommendation.estimated_savings.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {tripRecommendation.next_trip_details && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Next Trip Distance</span>
                        <span className="font-medium">{tripRecommendation.next_trip_details.distance_km.toFixed(0)} km</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Departure In</span>
                        <span className="font-medium">{tripRecommendation.next_trip_details.hours_until.toFixed(1)} hrs</span>
                      </div>
                    </div>
                  )}

                  {tripRecommendation.optimization_status && (
                    <div className="pt-2 border-t text-xs text-right text-muted-foreground">
                      Status: {tripRecommendation.optimization_status}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Card Benefits Section */}
        <Card className="border-2 border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <CreditCardIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Credit Card Gas Benefits</CardTitle>
                  <CardDescription>Maximize your fuel savings with credit card rewards</CardDescription>
                </div>
              </div>

              <Dialog open={creditCardDialogOpen} onOpenChange={setCreditCardDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    Add Card
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Credit Card</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Enter Your Credit Card Name</Label>
                      <Input
                        list="credit-card-suggestions"
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        placeholder="Type or select a credit card..."
                        className="w-full"
                      />
                      <datalist id="credit-card-suggestions">
                        {creditCardProviders.map((provider) => (
                          <option key={provider} value={provider} />
                        ))}
                      </datalist>
                      <p className="text-xs text-muted-foreground">
                        Type your card name or choose from suggestions
                      </p>
                    </div>
                    <Button
                      onClick={onAddCreditCard}
                      disabled={!selectedProvider.trim() || addingCard}
                      className="w-full"
                    >
                      {addingCard ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching Benefits...
                        </>
                      ) : (
                        "Add Card & Search Benefits"
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      We'll search the web using Google AI to find the latest gas and fuel benefits for your card.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {creditCards.length === 0 ? (
              <div className="text-center py-8">
                <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Credit Cards Added</h3>
                <p className="text-muted-foreground mb-4">
                  Add your credit cards to see their gas and fuel rewards benefits.
                </p>
                <Button onClick={() => setCreditCardDialogOpen(true)} variant="outline">
                  <CreditCardIcon className="h-4 w-4 mr-2" />
                  Add Your First Card
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {creditCards.map((card) => (
                  <div key={card.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <CreditCardIcon className="h-4 w-4 text-primary" />
                        {card.provider}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onRefreshCardBenefits(card.id)}
                          disabled={refreshingCardId === card.id}
                        >
                          {refreshingCardId === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onDeleteCreditCard(card.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {card.benefits ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {card.benefits.gas_cashback_percent && (
                          <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded">
                            <div className="text-xs text-muted-foreground">Gas Cashback</div>
                            <div className="font-semibold text-green-700 dark:text-green-400">
                              {card.benefits.gas_cashback_percent}% back
                            </div>
                          </div>
                        )}
                        {card.benefits.gas_cashback_cap && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                            <div className="text-xs text-muted-foreground">Annual Cap</div>
                            <div className="font-semibold text-blue-700 dark:text-blue-400">
                              ${card.benefits.gas_cashback_cap.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {card.benefits.partner_stations && card.benefits.partner_stations.length > 0 && (
                          <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded md:col-span-2">
                            <div className="text-xs text-muted-foreground mb-1">Partner Stations</div>
                            <div className="font-medium text-purple-700 dark:text-purple-400">
                              {card.benefits.partner_stations.join(", ")}
                            </div>
                          </div>
                        )}
                        {card.benefits.special_promotions && card.benefits.special_promotions.length > 0 && (
                          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded md:col-span-2">
                            <div className="text-xs text-muted-foreground mb-1">Special Promotions</div>
                            <ul className="text-sm space-y-1">
                              {card.benefits.special_promotions.map((promo, i) => (
                                <li key={i} className="text-yellow-800 dark:text-yellow-400">• {promo}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {card.benefits.notes && (
                          <div className="text-xs text-muted-foreground md:col-span-2 italic">
                            {card.benefits.notes}
                          </div>
                        )}
                        {/* Show message if no benefits found */}
                        {!card.benefits.gas_cashback_percent &&
                          !card.benefits.gas_cashback_cap &&
                          !card.benefits.partner_stations?.length &&
                          !card.benefits.special_promotions?.length && (
                            <div className="md:col-span-2 text-sm text-muted-foreground italic">
                              {card.benefits.notes || "No specific gas/fuel benefits found for this card."}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Loading benefits...
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Last updated: {new Date(card.last_updated).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optimal Gas Station Recommendation */}
        <Card className="border-2 border-green-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <Navigation className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Best Gas Station For You</CardTitle>
                  <CardDescription>Optimized for price, distance, and fuel cost to drive there</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOptimalStation}
                disabled={loadingOptimalStation || !userLocation}
              >
                {loadingOptimalStation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingOptimalStation ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3">Finding best stations...</span>
              </div>
            ) : optimalStation ? (
              <div className="space-y-4">
                {/* Best Station */}
                <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">#1 BEST</span>
                        <span className="text-lg font-semibold">{optimalStation.optimal.station.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{optimalStation.optimal.station.address}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${optimalStation.optimal.station.regular?.toFixed(3)}/L
                      </div>
                      {optimalStation.optimal.savings_vs_average > 0 && (
                        <div className="text-sm text-green-600">
                          Save ${optimalStation.optimal.savings_vs_average.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                      <div className="text-xs text-muted-foreground">Distance</div>
                      <div className="font-semibold">{optimalStation.optimal.distance_km.toFixed(1)} km</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                      <div className="text-xs text-muted-foreground">Drive Cost</div>
                      <div className="font-semibold">${optimalStation.optimal.fuel_cost_to_drive.toFixed(2)}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                      <div className="text-xs text-muted-foreground">Total Fill</div>
                      <div className="font-semibold">${optimalStation.optimal.total_cost_for_tank.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm italic text-green-700 dark:text-green-400">
                    💡 {optimalStation.optimal.reasoning}
                  </div>
                </div>

                {/* Analysis Summary */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                  {optimalStation.analysis_summary}
                </div>

                {/* Your Cards Being Used */}
                {optimalStation.your_cards_used && optimalStation.your_cards_used.length > 0 && (
                  <div className="flex items-center gap-2 text-sm bg-primary/10 p-2 rounded">
                    <CreditCardIcon className="h-4 w-4 text-primary" />
                    <span>Using your cards:</span>
                    <span className="font-medium">{optimalStation.your_cards_used.join(", ")}</span>
                  </div>
                )}

                {/* Credit Card Recommendations */}
                {optimalStation.card_recommendations && optimalStation.card_recommendations.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                      <CreditCardIcon className="h-4 w-4" />
                      Get These Cards to Save More!
                    </h4>
                    <div className="space-y-2">
                      {optimalStation.card_recommendations.map((rec) => (
                        <div key={rec.card_name} className="bg-white dark:bg-gray-800 rounded p-3 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{rec.card_name}</div>
                            <div className="text-xs text-muted-foreground">{rec.why_recommended}</div>
                          </div>
                          <div className="text-lg font-bold text-blue-600">+${rec.potential_savings_per_fill.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                {optimalStation.alternatives.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Other Options:</h4>
                    {optimalStation.alternatives.slice(0, 3).map((alt) => (
                      <div key={alt.station.id} className="flex items-center justify-between border rounded p-3 text-sm">
                        <div>
                          <span className="font-medium">#{alt.rank} {alt.station.name}</span>
                          <span className="text-muted-foreground ml-2">({alt.distance_km.toFixed(1)} km)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${alt.station.regular?.toFixed(3)}/L</div>
                          <div className="text-xs text-muted-foreground">Total: ${alt.total_cost_for_tank.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Navigation className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Enable location access to find the best gas station near you</p>
              </div>
            )}
          </CardContent>
        </Card>


        

        {/* Ad Banner */}
        <div className="mt-6 flex justify-center">
          <AdBanner slot="dashboard-rectangle" format="rectangle" />
        </div>
      </div >
    </Layout >
  );
}

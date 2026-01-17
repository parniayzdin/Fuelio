import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Lightbulb, Save, Car as CarIcon, MapPin, Check, Upload } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getRegions, evaluateDecision, createFillup, getTripGuess, getVehicle, updateVehicle, getPriceHistory, getFillups, getTripRecommendation, type TripRecommendation, uploadReceipt } from "@/api/endpoints";
import type { Region, DecisionResponse, TripGuess, EvaluateRequest, CreateFillupRequest, Alert, Vehicle, PricePoint, Fillup } from "@/types";

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
  const [regions, setRegions] = useState<Region[]>([]);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [tripGuess, setTripGuess] = useState<TripGuess | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [todayPrice, setTodayPrice] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSavingFillup, setIsSavingFillup] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [fillupDialogOpen, setFillupDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [fillups, setFillups] = useState<Fillup[]>([]);
  const [tripRecommendation, setTripRecommendation] = useState<TripRecommendation | null>(null);
  const [manualSpending, setManualSpending] = useState<number>(0);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm<EvaluateFormData>({
    defaultValues: {
      region_id: "",
      fuel_anchor_type: "percent",
      fuel_percent: 50,
      last_fillup_date: undefined,
      planned_trip_km: "",
      use_predicted_trip: false,
    },
  });

  const {
    control: fillupControl,
    handleSubmit: handleFillupSubmit,
    reset: resetFillup,
    watch: watchFillup,
  } = useForm<FillupFormData>({
    defaultValues: {
      date: new Date(),
      time: format(new Date(), "HH:mm"),
      full_tank: true,
      fuel_percent: "",
      liters: "",
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
  const watchedFullTank = watchFillup("full_tank");

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
    if (watchedRegion) {
      getPriceHistory(watchedRegion, 1).then(prices => {
        if (prices.length > 0) {
          // Find today's price or most recent
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const today = prices.find(p => p.date === todayStr);
          if (today) {
            setTodayPrice(today.price);
          } else {
            // fallback to latest
            setTodayPrice(prices[prices.length - 1].price);
          }
        }
      }).catch(console.error);
    }
  }, [watchedRegion]);

  useEffect(() => {
    getFillups().then(setFillups).catch(console.error);
    getTripRecommendation().then(setTripRecommendation).catch(console.error);
  }, []);

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

  const onSaveFillup = async (data: FillupFormData) => {
    setIsSavingFillup(true);
    try {
      const [hours, minutes] = data.time.split(":").map(Number);
      const timestamp = new Date(data.date);
      timestamp.setHours(hours, minutes, 0, 0);

      const request: CreateFillupRequest = {
        timestamp: timestamp.toISOString(),
        full_tank: data.full_tank,
        fuel_percent: data.full_tank ? undefined : parseFloat(data.fuel_percent),
        liters: parseFloat(data.liters),
      };

      await createFillup(request);
      setFillupDialogOpen(false);
      resetFillup();
    } catch (error) {
      console.error("Failed to save fillup:", error);
    } finally {
      setIsSavingFillup(false);
    }
  };

  // Calculate monthly spending from fillups (add to manual)
  const calculatedSpending = fillups
    .filter(f => {
      const fillupDate = new Date(f.time);
      const now = new Date();
      return fillupDate.getMonth() === now.getMonth() &&
        fillupDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, f) => {
      const liters = f.liters_optional || 0;
      const pricePerLiter = todayPrice || 0;
      return sum + (liters * pricePerLiter);
    }, 0);

  const totalSpending = calculatedSpending + manualSpending;

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const result = await uploadReceipt(file);
      if (result.fillup_created) {
        // Refresh fillups
        getFillups().then(setFillups).catch(console.error);
      }
      if (result.extracted_data.total_amount) {
        setManualSpending(prev => prev + result.extracted_data.total_amount!);
      }
    } catch (error) {
      console.error('Failed to upload receipt:', error);
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Calculate range remaining
  const rangeRemaining = vehicle && watchedFuelAnchorType === 'percent'
    ? ((vehicle.tank_size_liters * (watch("fuel_percent") / 100)) / vehicle.efficiency_l_per_100km) * 100
    : null;

  return (
    <Layout>
      <div className="space-y-8">

        {/* Top Row: KPI HUD */}
        <div className="grid gap-4 md:grid-cols-3">

          {/* Card 1: Range Remaining */}
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
                  <span className="font-medium">{watch("fuel_percent")}%</span>
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
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Monthly Spending */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fuel Spending (Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start mb-4">
                <div className="text-3xl font-bold">
                  ${totalSpending.toFixed(2)}
                </div>
                <div className="flex gap-1">
                  {/* Upload Button */}
                  <Input
                    id="receipt-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptUpload}
                    disabled={uploadingReceipt}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => document.getElementById('receipt-upload')?.click()}
                    disabled={uploadingReceipt}
                  >
                    {uploadingReceipt ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manual Adjustment ($)</Label>
                <Input
                  type="number"
                  value={manualSpending}
                  onChange={(e) => setManualSpending(parseFloat(e.target.value) || 0)}
                  className="h-8"
                  step="0.01"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Market Pulse (Combined Decision + Price) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Market Pulse</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {todayPrice ? `$${todayPrice.toFixed(3)}` : 'Loading...'} <span className="text-sm font-normal text-muted-foreground">/L</span>
              </div>
              {decision ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "text-xs px-2 py-1 rounded font-medium",
                      decision.price_change_percent > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    )}>
                      {decision.price_change_percent > 0 ? "Rising" : "Falling"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Forecast: ${decision.predicted_price.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {decision.explanation}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Analyzing market trends...</p>
              )}
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
              <div className="py-8 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-medium text-foreground">No Upcoming Trips</h3>
                <p className="text-muted-foreground">Plan a trip on the Gas Map to activate AI recommendations.</p>
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

        {/* Bottom Row: Management */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* My Vehicle */}
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
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No vehicle configured</p>
                  <Button variant="link" onClick={() => setVehicleDialogOpen(true)}>Add Vehicle</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Fillup Log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Save className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={fillupDialogOpen} onOpenChange={setFillupDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full py-6 text-base" variant="secondary">
                    <Save className="mr-2 h-5 w-5" />
                    Log Manual Fill-up
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Fill-up</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleFillupSubmit(onSaveFillup)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Controller
                          name="date"
                          control={fillupControl}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(field.value, "MMM d")}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => date && field.onChange(date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Controller
                          name="time"
                          control={fillupControl}
                          render={({ field }) => (
                            <Input type="time" {...field} />
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Controller
                        name="full_tank"
                        control={fillupControl}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <Label>Full tank</Label>
                    </div>

                    {!watchedFullTank && (
                      <div className="space-y-2">
                        <Label>Fuel Percentage After</Label>
                        <Controller
                          name="fuel_percent"
                          control={fillupControl}
                          render={({ field }) => (
                            <Input type="number" placeholder="e.g. 75" {...field} />
                          )}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Liters</Label>
                      <Controller
                        name="liters"
                        control={fillupControl}
                        render={({ field }) => (
                          <Input type="number" step="0.1" placeholder="e.g. 45.5" {...field} />
                        )}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSavingFillup}>
                      {isSavingFillup ? "Saving..." : "Save Fill-up"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground mb-2">Recent Activity</p>
                <div className="text-sm font-medium">
                  {fillups.length > 0 ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      Last fill-up: {format(new Date(fillups[0].time), "MMM d")} ({fillups[0].liters_optional}L)
                    </span>
                  ) : (
                    "No history recorded"
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ad Banner */}
        <div className="mt-6 flex justify-center">
          <AdBanner slot="dashboard-rectangle" format="rectangle" />
        </div>
      </div >
    </Layout >
  );
}

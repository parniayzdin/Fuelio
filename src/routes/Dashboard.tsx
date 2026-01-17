import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Lightbulb, Save } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DecisionBadge } from "@/components/DecisionBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
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
import { getRegions, evaluateDecision, createFillup, getTripGuess } from "@/api/endpoints";
import type { Region, DecisionResponse, TripGuess, EvaluateRequest, CreateFillupRequest, Alert } from "@/types";

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

export function Dashboard() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [tripGuess, setTripGuess] = useState<TripGuess | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSavingFillup, setIsSavingFillup] = useState(false);
  const [fillupDialogOpen, setFillupDialogOpen] = useState(false);

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
  } = useForm<FillupFormData>({
    defaultValues: {
      date: new Date(),
      time: format(new Date(), "HH:mm"),
      full_tank: true,
      fuel_percent: "",
      liters: "",
    },
  });

  const watchRegionId = watch("region_id");
  const watchAnchorType = watch("fuel_anchor_type");

  useEffect(() => {
    getRegions()
      .then(setRegions)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (watchRegionId) {
      getTripGuess(watchRegionId)
        .then(setTripGuess)
        .catch(() => setTripGuess(null));
    }
  }, [watchRegionId]);

  const onEvaluate = async (data: EvaluateFormData) => {
    if (!data.region_id) return;

    setIsEvaluating(true);
    try {
      const request: EvaluateRequest = {
        region_id: data.region_id,
        fuel_anchor:
          data.fuel_anchor_type === "percent"
            ? { type: "percent", percent: data.fuel_percent }
            : { type: "last_full_fillup_date", date: format(data.last_fillup_date!, "yyyy-MM-dd") },
        use_predicted_trip: data.use_predicted_trip,
      };

      if (data.planned_trip_km && !data.use_predicted_trip) {
        request.planned_trip_km = parseFloat(data.planned_trip_km);
      }

      const result = await evaluateDecision(request);
      setDecision(result);

      // Save to local alerts
      const alerts: Alert[] = JSON.parse(localStorage.getItem("alerts") || "[]");
      const newAlert: Alert = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        decision: result.decision,
        severity: result.severity,
        explanation: result.explanation,
        status: "new",
      };
      alerts.unshift(newAlert);
      localStorage.setItem("alerts", JSON.stringify(alerts.slice(0, 50)));
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const onSaveFillup = async (data: FillupFormData) => {
    setIsSavingFillup(true);
    try {
      const [hours, minutes] = data.time.split(":").map(Number);
      const datetime = new Date(data.date);
      datetime.setHours(hours, minutes, 0, 0);

      const request: CreateFillupRequest = {
        time: datetime.toISOString(),
        full_tank_bool: data.full_tank,
      };

      if (data.fuel_percent) {
        request.fuel_percent_optional = parseFloat(data.fuel_percent);
      }
      if (data.liters) {
        request.liters_optional = parseFloat(data.liters);
      }

      await createFillup(request);
      setFillupDialogOpen(false);
      resetFillup();
    } catch (error) {
      console.error("Failed to save fill-up:", error);
    } finally {
      setIsSavingFillup(false);
    }
  };

  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Decision Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fuel Decision</CardTitle>
            <CardDescription>
              Get a recommendation based on prices and your driving patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {decision ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <DecisionBadge decision={decision.decision} />
                  <SeverityBadge severity={decision.severity} />
                  <span className="text-lg font-medium">
                    {Math.round(decision.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-muted-foreground">{decision.explanation}</p>
                {decision.evidence && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Range</p>
                      <p className="text-lg font-semibold">{decision.evidence.range_km} km</p>
                    </div>
                    {decision.evidence.today_price && (
                      <div>
                        <p className="text-sm text-muted-foreground">Today's Price</p>
                        <p className="text-lg font-semibold">¢{decision.evidence.today_price.toFixed(1)}</p>
                      </div>
                    )}
                    {decision.evidence.price_trend && (
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <p className="text-lg font-semibold capitalize">{decision.evidence.price_trend}</p>
                      </div>
                    )}
                    {decision.evidence.liters_remaining !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Fuel Left</p>
                        <p className="text-lg font-semibold">{decision.evidence.liters_remaining.toFixed(1)}L</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Configure your inputs and click Evaluate to get a recommendation
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trip Guess Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Trip Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tripGuess ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Trip in next 24h</p>
                  <p className="text-2xl font-bold">
                    {Math.round(tripGuess.probability_trip_next_24h * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected distance</p>
                  <p className="text-lg font-semibold">{tripGuess.expected_trip_distance_km} km</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a region to see trip predictions
              </p>
            )}
          </CardContent>
        </Card>

        {/* Inputs Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evaluation Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onEvaluate)} className="space-y-6">
              {/* Region */}
              <div className="space-y-2">
                <Label>Region</Label>
                <Controller
                  name="region_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Fuel Anchor */}
              <div className="space-y-4">
                <Label>Fuel Level</Label>
                <Controller
                  name="fuel_anchor_type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-4"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="percent" id="percent" />
                        <Label htmlFor="percent" className="flex-1">
                          Current fuel percentage
                        </Label>
                      </div>
                      {watchAnchorType === "percent" && (
                        <div className="pl-7 space-y-2">
                          <Controller
                            name="fuel_percent"
                            control={control}
                            render={({ field }) => (
                              <div className="space-y-2">
                                <Slider
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={[field.value]}
                                  onValueChange={([v]) => field.onChange(v)}
                                />
                                <p className="text-sm text-muted-foreground text-right">
                                  {field.value}%
                                </p>
                              </div>
                            )}
                          />
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="last_full_fillup_date" id="date" />
                        <Label htmlFor="date" className="flex-1">
                          Last full fill-up date
                        </Label>
                      </div>
                      {watchAnchorType === "last_full_fillup_date" && (
                        <div className="pl-7">
                          <Controller
                            name="last_fillup_date"
                            control={control}
                            render={({ field }) => (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          />
                        </div>
                      )}
                    </RadioGroup>
                  )}
                />
              </div>

              {/* Planned Trip */}
              <div className="space-y-2">
                <Label htmlFor="planned_trip">Planned trip distance (km)</Label>
                <Controller
                  name="planned_trip_km"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="planned_trip"
                      type="number"
                      placeholder="Optional"
                      {...field}
                    />
                  )}
                />
              </div>

              {/* Use Predicted Trip */}
              <div className="flex items-center justify-between">
                <Label htmlFor="use_predicted">Use predicted trip distance</Label>
                <Controller
                  name="use_predicted_trip"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="use_predicted"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button type="submit" disabled={isEvaluating} className="flex-1">
                  {isEvaluating ? "Evaluating..." : "Evaluate"}
                </Button>
                <Dialog open={fillupDialogOpen} onOpenChange={setFillupDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Fill-up
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
                                    {format(field.value, "PP")}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(d) => d && field.onChange(d)}
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fillup_time">Time</Label>
                          <Controller
                            name="time"
                            control={fillupControl}
                            render={({ field }) => (
                              <Input id="fillup_time" type="time" {...field} />
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="full_tank">Full tank</Label>
                        <Controller
                          name="full_tank"
                          control={fillupControl}
                          render={({ field }) => (
                            <Switch
                              id="full_tank"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fillup_percent">Fuel % (optional)</Label>
                          <Controller
                            name="fuel_percent"
                            control={fillupControl}
                            render={({ field }) => (
                              <Input
                                id="fillup_percent"
                                type="number"
                                min={0}
                                max={100}
                                placeholder="e.g. 80"
                                {...field}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fillup_liters">Liters (optional)</Label>
                          <Controller
                            name="liters"
                            control={fillupControl}
                            render={({ field }) => (
                              <Input
                                id="fillup_liters"
                                type="number"
                                step="0.1"
                                placeholder="e.g. 45.5"
                                {...field}
                              />
                            )}
                          />
                        </div>
                      </div>

                      <Button type="submit" className="w-full" disabled={isSavingFillup}>
                        {isSavingFillup ? "Saving..." : "Save Fill-up"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

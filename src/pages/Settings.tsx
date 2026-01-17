import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVehicle, updateVehicle, getRegions } from "@/api/endpoints";
import type { Vehicle, Region } from "@/types";

interface VehicleFormData {
  tank_size_liters: string;
  efficiency_l_per_100km: string;
  reserve_fraction: string;
  default_region_id: string;
}

export function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleFormData>();

  useEffect(() => {
    Promise.all([getVehicle(), getRegions()])
      .then(([vehicle, regionsData]) => {
        reset({
          tank_size_liters: vehicle.tank_size_liters.toString(),
          efficiency_l_per_100km: vehicle.efficiency_l_per_100km.toString(),
          reserve_fraction: vehicle.reserve_fraction.toString(),
          default_region_id: vehicle.default_region_id || "",
        });
        setRegions(regionsData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [reset]);

  const onSubmit = async (data: VehicleFormData) => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const vehicle: Vehicle = {
        tank_size_liters: parseFloat(data.tank_size_liters),
        efficiency_l_per_100km: parseFloat(data.efficiency_l_per_100km),
        reserve_fraction: parseFloat(data.reserve_fraction),
        default_region_id: data.default_region_id || null,
      };
      await updateVehicle(vehicle);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-muted-foreground">Loading settings...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your vehicle and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Settings</CardTitle>
            <CardDescription>
              Enter your vehicle details for accurate fuel calculations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tank_size_liters">Tank Size (Liters)</Label>
                <Input
                  id="tank_size_liters"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 55"
                  {...register("tank_size_liters", { required: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="efficiency_l_per_100km">Fuel Efficiency (L/100km)</Label>
                <Input
                  id="efficiency_l_per_100km"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 8.5"
                  {...register("efficiency_l_per_100km", { required: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reserve_fraction">Reserve Warning Level</Label>
                <Input
                  id="reserve_fraction"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  placeholder="e.g. 0.15"
                  {...register("reserve_fraction", { required: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Fraction of tank to warn at (0.15 = 15%)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Region</Label>
                <Controller
                  name="default_region_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name} ({region.country})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

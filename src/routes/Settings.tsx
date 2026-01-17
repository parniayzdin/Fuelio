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
          <p className="text-muted-foreground">Configure your vehicle profile</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Profile</CardTitle>
            <CardDescription>
              Enter your vehicle details for accurate fuel calculations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tank_size">Tank Size (liters)</Label>
                <Input
                  id="tank_size"
                  type="number"
                  step="0.1"
                  {...register("tank_size_liters", {
                    required: "Required",
                    min: { value: 1, message: "Must be at least 1" },
                  })}
                />
                {errors.tank_size_liters && (
                  <p className="text-sm text-destructive">{errors.tank_size_liters.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="efficiency">Fuel Efficiency (L/100km)</Label>
                <Input
                  id="efficiency"
                  type="number"
                  step="0.1"
                  {...register("efficiency_l_per_100km", {
                    required: "Required",
                    min: { value: 0.1, message: "Must be positive" },
                  })}
                />
                {errors.efficiency_l_per_100km && (
                  <p className="text-sm text-destructive">{errors.efficiency_l_per_100km.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reserve">Reserve Fraction (0-1)</Label>
                <Input
                  id="reserve"
                  type="number"
                  step="0.01"
                  {...register("reserve_fraction", {
                    required: "Required",
                    min: { value: 0, message: "Min 0" },
                    max: { value: 1, message: "Max 1" },
                  })}
                />
                <p className="text-sm text-muted-foreground">
                  Percentage of tank to keep as reserve (e.g., 0.15 = 15%)
                </p>
                {errors.reserve_fraction && (
                  <p className="text-sm text-destructive">{errors.reserve_fraction.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Default Region</Label>
                <Controller
                  name="default_region_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default region" />
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

              <div className="flex items-center gap-4 pt-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
                {saveSuccess && (
                  <span className="text-sm text-severity-low">Settings saved!</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

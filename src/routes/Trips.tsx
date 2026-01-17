import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getTrips, createTrip, deleteTrip } from "@/api/endpoints";
import type { Trip, CreateTripRequest } from "@/types";

interface TripFormData {
  start_date: Date;
  start_time: string;
  end_date: Date;
  end_time: string;
  distance_km: string;
}

export function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TripFormData>({
    defaultValues: {
      start_date: new Date(),
      start_time: "08:00",
      end_date: new Date(),
      end_time: "09:00",
      distance_km: "",
    },
  });

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const data = await getTrips();
      setTrips(data);
    } catch (error) {
      console.error("Failed to load trips:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: TripFormData) => {
    setIsSubmitting(true);
    try {
      const [startHours, startMinutes] = data.start_time.split(":").map(Number);
      const startDateTime = new Date(data.start_date);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const [endHours, endMinutes] = data.end_time.split(":").map(Number);
      const endDateTime = new Date(data.end_date);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      const request: CreateTripRequest = {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        distance_km: parseFloat(data.distance_km),
      };

      await createTrip(request);
      await loadTrips();
      setDialogOpen(false);
      reset();
    } catch (error) {
      console.error("Failed to create trip:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrip(id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Failed to delete trip:", error);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trips</h1>
            <p className="text-muted-foreground">Track your driving history</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Trip</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Controller
                      name="start_date"
                      control={control}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start">
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
                    <Controller
                      name="start_time"
                      control={control}
                      render={({ field }) => <Input type="time" {...field} />}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Controller
                      name="end_date"
                      control={control}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start">
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
                    <Controller
                      name="end_time"
                      control={control}
                      render={({ field }) => <Input type="time" {...field} />}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    {...register("distance_km", {
                      required: "Distance is required",
                      min: { value: 0.1, message: "Must be positive" },
                    })}
                  />
                  {errors.distance_km && (
                    <p className="text-sm text-destructive">{errors.distance_km.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Trip"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trip History</CardTitle>
            <CardDescription>All your recorded trips</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading trips...</p>
            ) : trips.length === 0 ? (
              <p className="text-muted-foreground">No trips recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>
                        {format(new Date(trip.start_time), "PP")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(trip.start_time), "p")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(trip.end_time), "p")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {trip.distance_km} km
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(trip.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

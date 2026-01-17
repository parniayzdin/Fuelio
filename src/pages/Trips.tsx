import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2, MapPin, Upload } from "lucide-react";
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
import { getTrips, createTrip, deleteTrip, importTimeline } from "@/api/endpoints";
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
  const [isImporting, setIsImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importTimeline(file);
      await loadTrips();
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to import timeline:", error);
      alert("Failed to import timeline. Please check the file format.");
    } finally {
      setIsImporting(false);
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
      setDialogOpen(false);
      reset();
      await loadTrips();
    } catch (error) {
      console.error("Failed to create trip:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrip(id);
      await loadTrips();
    } catch (error) {
      console.error("Failed to delete trip:", error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-muted-foreground">Loading trips...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trips</h1>
            <p className="text-muted-foreground">Log your trips to improve fuel predictions</p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleFileUpload}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : "Import Timeline"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Trip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Trip</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Controller
                        name="start_date"
                        control={control}
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
                      <Label>Start Time</Label>
                      <Controller
                        name="start_time"
                        control={control}
                        render={({ field }) => (
                          <Input type="time" {...field} />
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Controller
                        name="end_date"
                        control={control}
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
                      <Label>End Time</Label>
                      <Controller
                        name="end_time"
                        control={control}
                        render={({ field }) => (
                          <Input type="time" {...field} />
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Distance (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 45.5"
                      {...register("distance_km", { required: true })}
                    />
                    {errors.distance_km && (
                      <p className="text-sm text-destructive">Distance is required</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Trip"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {trips.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No trips recorded yet. Add your first trip to start tracking.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>
                        {format(new Date(trip.start_time), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(trip.start_time), "HH:mm")} - {trip.end_time ? format(new Date(trip.end_time), "HH:mm") : "?"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[200px]" title={trip.start_address || `${trip.start_location_lat}, ${trip.start_location_lng}`}>
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate text-sm">{trip.start_address || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[200px]" title={trip.end_address || `${trip.end_location_lat}, ${trip.end_location_lng}`}>
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate text-sm">{trip.end_address || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{trip.distance_km?.toFixed(1) || "-"} km</TableCell>
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
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

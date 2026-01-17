import { useCallback, useState, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from "@react-google-maps/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Locate, Fuel, RefreshCw, AlertCircle, TrendingUp, MapPin, Plus, X, Check, Trash2 } from "lucide-react";
import { StationForecastModal } from "@/components/StationForecastModal";
import { AdBanner } from "@/components/promotions";
import { getGasStations, type GasStationResponse, createTrip, deleteAllTrips, createFillup } from "@/api/endpoints";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// You need to add your Google Maps API key here or in .env as VITE_GOOGLE_MAPS_API_KEY
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface GasStation {
    id: string;
    name: string;
    brand: string;
    lat: number;
    lng: number;
    address: string;
    regular: number;
    premium?: number;
    diesel?: number;
    lastUpdated: string;
}

function getMarkerColor(price: number): string {
    if (price < 1.40) return "#22c55e"; // Green - cheap
    if (price < 1.50) return "#eab308"; // Yellow - mid
    return "#ef4444"; // Red - expensive
}

const mapContainerStyle = {
    width: "100%",
    height: "500px",
};

const ontarioCenter = {
    lat: 43.65,
    lng: -79.38,
};

const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
};

function GasMapWithKey() {
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });

    const [stations, setStations] = useState<GasStation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
    const [forecastStation, setForecastStation] = useState<GasStation | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [mapCenter, setMapCenter] = useState(ontarioCenter);
    const mapRef = useRef<google.maps.Map | null>(null);
    const [showSearchButton, setShowSearchButton] = useState(false);

    // Trip creation state
    const [createTripMode, setCreateTripMode] = useState(false);
    const [startPin, setStartPin] = useState<{ lat: number; lng: number } | null>(null);
    const [endPin, setEndPin] = useState<{ lat: number; lng: number } | null>(null);
    const [showTripDialog, setShowTripDialog] = useState(false);
    const [savingTrip, setSavingTrip] = useState(false);
    const [tripDateTime, setTripDateTime] = useState<string>("");
    const [clearingTrips, setClearingTrips] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<string>("daily");
    const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
    // Fill-up dialog state
    const [showFillupDialog, setShowFillupDialog] = useState(false);
    const [fillupFullTank, setFillupFullTank] = useState(true);
    const [fillupLiters, setFillupLiters] = useState("");
    const [fillupPercentAfter, setFillupPercentAfter] = useState("");
    const [fillupSaving, setFillupSaving] = useState(false);
    const [fillupWhen, setFillupWhen] = useState<string>(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0,16);
    });
    const [drivingDistanceKm, setDrivingDistanceKm] = useState<number>(0);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    const onMapDragEnd = useCallback(() => {
        setShowSearchButton(true);
    }, []);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!createTripMode || !e.latLng) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (!startPin) {
            setStartPin({ lat, lng });
            setDirectionsResult(null);
            setDrivingDistanceKm(0);
        } else if (!endPin) {
            const newEndPin = { lat, lng };
            setEndPin(newEndPin);

            // Fetch directions for road-based route
            const directionsService = new google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: startPin,
                    destination: newEndPin,
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK && result) {
                        setDirectionsResult(result);
                        // Get driving distance in km
                        const distanceMeters = result.routes[0]?.legs[0]?.distance?.value || 0;
                        setDrivingDistanceKm(distanceMeters / 1000);
                    } else {
                        console.error('Directions request failed:', status);
                        // Fallback to straight-line if directions fail
                        const R = 6371;
                        const dLat = (newEndPin.lat - startPin.lat) * Math.PI / 180;
                        const dLon = (newEndPin.lng - startPin.lng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) ** 2 + Math.cos(startPin.lat * Math.PI / 180) * Math.cos(newEndPin.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        setDrivingDistanceKm(R * c);
                    }
                }
            );

            // Set default datetime to current time
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setTripDateTime(now.toISOString().slice(0, 16));
            setShowTripDialog(true);
        }
    }, [createTripMode, startPin, endPin]);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleSaveTrip = async () => {
        if (!startPin || !endPin || !tripDateTime) return;

        setSavingTrip(true);
        try {
            const tripTime = new Date(tripDateTime).toISOString();

            await createTrip({
                start_location_lat: startPin.lat,
                start_location_lng: startPin.lng,
                end_location_lat: endPin.lat,
                end_location_lng: endPin.lng,
                start_time: tripTime,
                end_time: tripTime,
                distance_km: drivingDistanceKm,
            });

            // Reset state
            setShowTripDialog(false);
            setCreateTripMode(false);
            setStartPin(null);
            setEndPin(null);
            setTripDateTime("");
            setDirectionsResult(null);
            setDrivingDistanceKm(0);
        } catch (error) {
            console.error('Failed to create trip:', error);
        } finally {
            setSavingTrip(false);
        }
    };

    const handleCancelTrip = () => {
        setShowTripDialog(false);
        setCreateTripMode(false);
        setStartPin(null);
        setEndPin(null);
        setTripDateTime("");
        setIsRecurring(false);
        setRecurrenceFrequency("daily");
        setDirectionsResult(null);
        setDrivingDistanceKm(0);
    };

    const toggleTripCreationMode = () => {
        if (createTripMode) {
            // Cancel mode
            setCreateTripMode(false);
            setStartPin(null);
            setEndPin(null);
            setDirectionsResult(null);
            setDrivingDistanceKm(0);
        } else {
            // Enable mode
            setCreateTripMode(true);
        }
    };

    // Fetch gas stations based on map center, optionally with radius
    const fetchStations = useCallback(async (center: { lat: number; lng: number }, radius: number = 10000) => {
        setLoading(true);
        setError(null);
        setShowSearchButton(false); // Hide button when searching
        try {
            // Use provided radius or default to 10km (unless capped by API call inside)
            const fetchedStations = await getGasStations(center.lat, center.lng, radius);

            // Convert API response to our format
            const converted: GasStation[] = fetchedStations.map(s => ({
                id: s.id,
                name: s.name,
                brand: s.brand,
                lat: s.lat,
                lng: s.lng,
                address: s.address,
                regular: s.regular || 1.42,
                premium: s.premium || undefined,
                diesel: s.diesel || undefined,
                lastUpdated: s.lastUpdated,
            }));

            setStations(prev => {
                // Merge new stations with existing ones, avoiding duplicates by ID
                const existingIds = new Set(prev.map(p => p.id));
                const newUnique = converted.filter(s => !existingIds.has(s.id));
                return [...prev, ...newUnique];
            });
        } catch (err) {
            console.error("Failed to fetch gas stations:", err);
            setError("Failed to load gas stations. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load: Try to locate user, otherwise default to Ontario center
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setUserLocation(pos);
                    setMapCenter(pos);
                    // Zoom level 12 is closer ("completely zoomed in" feel) while keeping context
                    mapRef.current?.setZoom(12);
                    fetchStations(pos, 20000); // Fetch 20km radius (comprehensive local search)
                },
                () => {
                    console.log("Geolocation permission denied or failed");
                    // Fallback to default center with 20km search
                    fetchStations(mapCenter, 20000);
                }
            );
        } else {
            fetchStations(mapCenter, 20000);
        }
    }, []); // Only run once on mount

    const handleLocate = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setUserLocation(pos);
                    setMapCenter(pos);
                    mapRef.current?.panTo(pos);
                    mapRef.current?.setZoom(13);
                    fetchStations(pos);
                },
                () => {
                    console.error("Geolocation failed");
                }
            );
        }
    };

    const handleSearchArea = () => {
        const map = mapRef.current;
        if (!map) return;

        const center = map.getCenter();
        const bounds = map.getBounds();

        if (center && bounds) {
            // Calculate radius based on bounds properly
            // Get center and NE corner
            const ne = bounds.getNorthEast();

            // Calculate distance in meters using Haversine formula roughly
            // Or use geometry library if available, but simple approximation is fine for this
            const R = 6371e3; // metres
            const φ1 = center.lat() * Math.PI / 180;
            const φ2 = ne.lat() * Math.PI / 180;
            const Δφ = (ne.lat() - center.lat()) * Math.PI / 180;
            const Δλ = (ne.lng() - center.lng()) * Math.PI / 180;

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dist = R * c; // Distance in meters

            // Limit to 50km (API Max) or minimum 2km
            const radius = Math.min(Math.max(Math.round(dist), 2000), 50000);

            console.log(`Searching with radius: ${radius}m`);
            fetchStations({ lat: center.lat(), lng: center.lng() }, radius);
        }
    };

    const cheapestStation = stations.length > 0
        ? stations.reduce((min, s) => s.regular < min.regular ? s : min, stations[0])
        : null;
    const avgPrice = stations.length > 0
        ? stations.reduce((sum, s) => sum + s.regular, 0) / stations.length
        : 0;

    if (loadError) {
        return (
            <Layout>
                <div className="p-4 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-500">Error loading Google Maps</h2>
                    <p className="text-muted-foreground">Please check your API key configuration.</p>
                </div>
            </Layout>
        );
    }

    if (!isLoaded) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-96">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading map...</span>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Gas Prices Map</h1>
                        <p className="text-muted-foreground">Real-time fuel prices across Ontario</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleLocate} variant="outline" size="sm">
                            <Locate className="h-4 w-4 mr-2" />
                            Locate Me
                        </Button>
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <Card className="bg-red-50 dark:bg-red-900/10 border-red-200">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="h-5 w-5" />
                                <p>{error}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Cheapest Regular</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {cheapestStation ? (
                                <>
                                    <div className="text-2xl font-bold text-green-600">${cheapestStation.regular.toFixed(2)}/L</div>
                                    <p className="text-xs text-muted-foreground">{cheapestStation.brand} - {cheapestStation.name}</p>
                                </>
                            ) : (
                                <div className="text-sm text-muted-foreground">No stations loaded</div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Average Price</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stations.length > 0 ? (
                                <>
                                    <div className="text-2xl font-bold">${avgPrice.toFixed(2)}/L</div>
                                    <p className="text-xs text-muted-foreground">Across {stations.length} stations</p>
                                </>
                            ) : (
                                <div className="text-sm text-muted-foreground">Loading stations...</div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Price Legend</CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-3 text-sm">
                            <Badge style={{ backgroundColor: "#22c55e" }}>{"< $1.40"}</Badge>
                            <Badge style={{ backgroundColor: "#eab308" }}>$1.40-1.50</Badge>
                            <Badge style={{ backgroundColor: "#ef4444" }}>{"> $1.50"}</Badge>
                        </CardContent>
                    </Card>
                </div>

                {/* Map Container */}
                <Card className="overflow-hidden relative">
                    {/* Search This Area Button Overlay */}
                    {showSearchButton && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                            <Button
                                onClick={handleSearchArea}
                                className="bg-white text-black hover:bg-gray-100 shadow-lg rounded-full px-6 py-2 h-auto text-sm font-semibold border"
                            >
                                <RefreshCw className="h-3 w-3 mr-2" />
                                Search This Area
                            </Button>
                        </div>
                    )}

                    {/* Create Trip Button */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                        <Button
                            variant={createTripMode ? "destructive" : "default"}
                            onClick={toggleTripCreationMode}
                            className="shadow-lg"
                        >
                            {createTripMode ? (
                                <><X className="w-4 h-4 mr-2" />Cancel</>
                            ) : (
                                <><Plus className="w-4 h-4 mr-2" />Create Trip</>
                            )}
                        </Button>
                    </div>

                    {/* Trip creation instructions */}
                    {createTripMode && (
                        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-lg shadow-lg p-3 border">
                            <p className="text-sm font-medium">
                                {!startPin ? "📍 Click on map to set trip start" :
                                    !endPin ? "🎯 Click on map to set trip end" :
                                        "✅ Both pins placed"}
                            </p>
                        </div>
                    )}

                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={10}
                        options={mapOptions}
                        onClick={handleMapClick}
                        onLoad={onMapLoad}
                        onDragEnd={onMapDragEnd}
                    >
                        {/* User location marker */}
                        {userLocation && (
                            <Marker
                                position={userLocation}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 10,
                                    fillColor: "#4285F4",
                                    fillOpacity: 1,
                                    strokeColor: "#ffffff",
                                    strokeWeight: 3,
                                }}
                            />
                        )}

                        {/* Gas station markers */}
                        {stations.map((station) => (
                            <Marker
                                key={station.id}
                                position={{ lat: station.lat, lng: station.lng }}
                                onClick={() => setSelectedStation(station)}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 12,
                                    fillColor: getMarkerColor(station.regular),
                                    fillOpacity: 1,
                                    strokeColor: "#ffffff",
                                    strokeWeight: 2,
                                }}
                                label={{
                                    text: station.regular.toFixed(2),
                                    color: "#ffffff",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                }}
                            />
                        ))}

                        {/* Trip creation pins */}
                        {startPin && (
                            <Marker
                                position={startPin}
                                icon={{
                                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                                    scale: 6,
                                    fillColor: "#22c55e",
                                    fillOpacity: 1,
                                    strokeColor: "#ffffff",
                                    strokeWeight: 2,
                                }}
                                label={{
                                    text: "START",
                                    color: "#22c55e",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                }}
                            />
                        )}
                        {endPin && (
                            <Marker
                                position={endPin}
                                icon={{
                                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                                    scale: 6,
                                    fillColor: "#ef4444",
                                    fillOpacity: 1,
                                    strokeColor: "#ffffff",
                                    strokeWeight: 2,
                                }}
                                label={{
                                    text: "END",
                                    color: "#ef4444",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                }}
                            />
                        )}

                        {/* Directions route polyline */}
                        {directionsResult && (
                            <DirectionsRenderer
                                directions={directionsResult}
                                options={{
                                    suppressMarkers: true,
                                    polylineOptions: {
                                        strokeColor: '#3b82f6',
                                        strokeWeight: 6,
                                        strokeOpacity: 0.9,
                                    },
                                }}
                            />
                        )}

                        {/* Info window for selected station */}
                        {selectedStation && (
                            <InfoWindow
                                position={{ lat: selectedStation.lat, lng: selectedStation.lng }}
                                onCloseClick={() => setSelectedStation(null)}
                            >
                                <div className="min-w-[220px] p-2">
                                    <div className="font-bold text-lg">{selectedStation.brand}</div>
                                    <div className="text-sm text-gray-600 mb-2">{selectedStation.address}</div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span>Regular:</span>
                                            <span className="font-bold" style={{ color: getMarkerColor(selectedStation.regular) }}>
                                                ${selectedStation.regular.toFixed(2)}/L
                                            </span>
                                        </div>
                                        {selectedStation.premium && (
                                            <div className="flex justify-between text-sm">
                                                <span>Premium:</span>
                                                <span>${selectedStation.premium.toFixed(2)}/L</span>
                                            </div>
                                        )}
                                        {selectedStation.diesel && (
                                            <div className="flex justify-between text-sm">
                                                <span>Diesel:</span>
                                                <span>${selectedStation.diesel.toFixed(2)}/L</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">Updated {selectedStation.lastUpdated}</div>
                                    <button
                                        onClick={() => {
                                            setForecastStation(selectedStation);
                                            setSelectedStation(null);
                                        }}
                                        className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                                    >
                                        <TrendingUp className="h-3 w-3" />
                                        View Price Forecast
                                    </button>
                                    <button
                                        onClick={() => setShowFillupDialog(true)}
                                        className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                                    >
                                        <Fuel className="h-3 w-3" />
                                        Record Fill-up Here
                                    </button>
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>
                </Card>

                {/* Trip Confirmation Side Panel */}
                {showTripDialog && (
                    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l">
                        <Card className="border-0 rounded-none h-full">
                            <CardHeader className="border-b">
                                <CardTitle className="flex items-center justify-between">
                                    <span>Confirm Trip</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCancelTrip}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 py-6">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="text-sm font-medium">Start Location</p>
                                        <p className="text-xs text-muted-foreground">
                                            {startPin?.lat.toFixed(4)}, {startPin?.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-red-600" />
                                    <div>
                                        <p className="text-sm font-medium">End Location</p>
                                        <p className="text-xs text-muted-foreground">
                                            {endPin?.lat.toFixed(4)}, {endPin?.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <div className="border-t pt-4">
                                    <p className="text-sm font-medium">Driving Distance</p>
                                    <p className="text-2xl font-bold text-primary">
                                        {drivingDistanceKm.toFixed(2)} km
                                    </p>
                                </div>
                                <div className="border-t pt-4 space-y-2">
                                    <label className="text-sm font-medium">When is this trip?</label>
                                    <Input
                                        type="datetime-local"
                                        value={tripDateTime}
                                        onChange={(e) => setTripDateTime(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div className="border-t pt-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Recurring trip?</label>
                                        <Switch
                                            checked={isRecurring}
                                            onCheckedChange={setIsRecurring}
                                        />
                                    </div>
                                    {isRecurring && (
                                        <div className="space-y-2">
                                            <label className="text-sm text-muted-foreground">Frequency</label>
                                            <Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="weekdays">Weekdays Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                This trip will automatically repeat {recurrenceFrequency === 'daily' ? 'every day' : recurrenceFrequency === 'weekly' ? 'every week' : 'on weekdays'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="border-t pt-4 flex gap-2">
                                    <Button variant="outline" onClick={handleCancelTrip} disabled={savingTrip} className="flex-1">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveTrip} disabled={savingTrip} className="flex-1">
                                        {savingTrip ? 'Saving...' : 'Save Trip'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* StationForecastModal */}
                {forecastStation && (
                    <StationForecastModal
                        station={forecastStation}
                        onClose={() => setForecastStation(null)}
                    />
                )}

                {/* Record Fill-up Dialog */}
                {showFillupDialog && (
                    <Dialog open={showFillupDialog} onOpenChange={setShowFillupDialog}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Fill-up</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-muted-foreground">Date & Time</label>
                                    <Input type="datetime-local" value={fillupWhen} onChange={(e) => setFillupWhen(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={fillupFullTank} onCheckedChange={setFillupFullTank} />
                                    <span>Full tank</span>
                                </div>
                                {!fillupFullTank && (
                                    <div>
                                        <label className="text-sm text-muted-foreground">Fuel % After</label>
                                        <Input type="number" placeholder="e.g. 75" value={fillupPercentAfter} onChange={(e) => setFillupPercentAfter(e.target.value)} />
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm text-muted-foreground">Liters</label>
                                    <Input type="number" step="0.1" placeholder="e.g. 45.5" value={fillupLiters} onChange={(e) => setFillupLiters(e.target.value)} />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setShowFillupDialog(false)}>Cancel</Button>
                                    <Button
                                        className="flex-1"
                                        disabled={fillupSaving}
                                        onClick={async () => {
                                            try {
                                                setFillupSaving(true);
                                                const iso = new Date(fillupWhen).toISOString();
                                                await createFillup({
                                                    time: iso,
                                                    full_tank_bool: fillupFullTank,
                                                    fuel_percent_optional: fillupFullTank ? undefined : (fillupPercentAfter ? parseFloat(fillupPercentAfter) : undefined),
                                                    liters_optional: fillupLiters ? parseFloat(fillupLiters) : undefined,
                                                });
                                                // Update dashboard fuel slider via localStorage
                                                if (fillupFullTank) {
                                                    localStorage.setItem('fuel_percent', '100');
                                                } else if (fillupPercentAfter) {
                                                    const pct = Math.max(0, Math.min(100, Number(fillupPercentAfter)));
                                                    if (!Number.isNaN(pct)) localStorage.setItem('fuel_percent', String(pct));
                                                }
                                                setShowFillupDialog(false);
                                                setFillupLiters("");
                                                setFillupPercentAfter("");
                                            } catch (e) {
                                                console.error('Failed to record fill-up:', e);
                                            } finally {
                                                setFillupSaving(false);
                                            }
                                        }}
                                    >
                                        {fillupSaving ? 'Saving...' : 'Save Fill-up'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Sponsored Content */}
                <div className="flex justify-center">
                    <AdBanner slot="gasmap-responsive" format="responsive" />
                </div>

                {/* Station List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Fuel className="h-5 w-5" />
                            Nearby Stations (Sorted by Price)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[...stations].sort((a, b) => a.regular - b.regular).slice(0, 6).map((station) => (
                                <div
                                    key={station.id}
                                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => {
                                        setSelectedStation(station);
                                        mapRef.current?.panTo({ lat: station.lat, lng: station.lng });
                                        mapRef.current?.setZoom(14);
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium">{station.brand}</div>
                                            <div className="text-xs text-muted-foreground">{station.address}</div>
                                        </div>
                                        <div
                                            className="text-lg font-bold px-2 py-1 rounded"
                                            style={{ backgroundColor: getMarkerColor(station.regular) + "20", color: getMarkerColor(station.regular) }}
                                        >
                                            ${station.regular.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Station Forecast Modal */}
                <StationForecastModal
                    station={forecastStation}
                    onClose={() => setForecastStation(null)}
                />
            </div>
        </Layout>
    );
}

// Component that shows API key input if not configured
export function GasMap() {
    const [apiKey, setApiKey] = useState(GOOGLE_MAPS_API_KEY);
    const [tempKey, setTempKey] = useState("");

    if (!apiKey) {
        return (
            <Layout>
                <div className="max-w-xl mx-auto space-y-6 py-12">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-yellow-500" />
                                Google Maps API Key Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">
                                To use the gas prices map, you need to configure a Google Maps API key.
                            </p>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Option 1: Add to environment</p>
                                <code className="block p-2 bg-muted rounded text-sm">
                                    VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
                                </code>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Option 2: Enter temporarily</p>
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        placeholder="Enter your Google Maps API key"
                                        value={tempKey}
                                        onChange={(e) => setTempKey(e.target.value)}
                                    />
                                    <Button onClick={() => setApiKey(tempKey)}>
                                        Load Map
                                    </Button>
                                </div>
                            </div>
                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Get your API key from{" "}
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline"
                                    >
                                        Google Cloud Console
                                    </a>
                                    . Enable the Maps JavaScript API.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </Layout>
        );
    }

    return <GasMapWithKey />;
}

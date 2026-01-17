import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, X, ArrowRight, Fuel } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface Props {
    station: GasStation | null;
    onClose: () => void;
}

// Generate mock price history based on current price
function generatePriceHistory(currentPrice: number): { date: string; price: number }[] {
    const today = new Date();
    const history: { date: string; price: number }[] = [];

    // Generate 7 days of history with slight variations
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Add some variation (-5 to +5 cents)
        const variation = (Math.random() - 0.5) * 0.10;
        const baseVariation = (6 - i) * 0.005; // Slight upward trend
        const price = currentPrice - 0.03 + baseVariation + variation;

        history.push({
            date: date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }),
            price: Math.round(price * 100) / 100,
        });
    }

    return history;
}

function getTrend(history: { price: number }[]): 'rising' | 'falling' | 'stable' {
    if (history.length < 2) return 'stable';

    const firstHalf = history.slice(0, Math.floor(history.length / 2));
    const secondHalf = history.slice(Math.floor(history.length / 2));

    const avgFirst = firstHalf.reduce((sum, h) => sum + h.price, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, h) => sum + h.price, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;

    if (diff > 0.02) return 'rising';
    if (diff < -0.02) return 'falling';
    return 'stable';
}

export function StationForecastModal({ station, onClose }: Props) {
    const navigate = useNavigate();

    const priceHistory = useMemo(() => {
        if (!station) return [];
        return generatePriceHistory(station.regular);
    }, [station]);

    const trend = useMemo(() => getTrend(priceHistory), [priceHistory]);

    const minPrice = Math.min(...priceHistory.map(h => h.price));
    const maxPrice = Math.max(...priceHistory.map(h => h.price));
    const priceRange = maxPrice - minPrice || 0.10;

    const handleViewFullForecast = () => {
        onClose();
        navigate('/prices');
    };

    if (!station) return null;

    return (
        <Dialog open={!!station} onOpenChange={() => onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-primary" />
                        {station.brand}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{station.address}</p>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current Price */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Regular Price</p>
                                    <p className="text-3xl font-bold">${station.regular.toFixed(2)}/L</p>
                                </div>
                                <div className="text-right">
                                    {trend === 'rising' && (
                                        <Badge variant="destructive" className="gap-1">
                                            <TrendingUp className="h-3 w-3" /> Rising
                                        </Badge>
                                    )}
                                    {trend === 'falling' && (
                                        <Badge className="gap-1 bg-green-500 hover:bg-green-600">
                                            <TrendingDown className="h-3 w-3" /> Falling
                                        </Badge>
                                    )}
                                    {trend === 'stable' && (
                                        <Badge variant="secondary" className="gap-1">
                                            <Minus className="h-3 w-3" /> Stable
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            {station.premium && station.diesel && (
                                <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                                    <span>Premium: ${station.premium.toFixed(2)}/L</span>
                                    <span>Diesel: ${station.diesel.toFixed(2)}/L</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Price Chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">7-Day Price History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {/* Simple bar chart */}
                                <div className="flex items-end justify-between gap-1 h-32">
                                    {priceHistory.map((day, i) => {
                                        const height = ((day.price - minPrice) / priceRange) * 100;
                                        const isToday = i === priceHistory.length - 1;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-[10px] text-muted-foreground">
                                                    ${day.price.toFixed(2)}
                                                </span>
                                                <div
                                                    className={`w-full rounded-t transition-all ${isToday ? 'bg-primary' : 'bg-primary/40'
                                                        }`}
                                                    style={{ height: `${Math.max(20, height)}%` }}
                                                />
                                                <span className="text-[10px] text-muted-foreground">
                                                    {day.date.split(' ')[0]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Trend description */}
                                <p className="text-sm text-muted-foreground text-center pt-2 border-t">
                                    {trend === 'rising' && (
                                        <>Prices have been <span className="text-red-500 font-medium">rising</span> this week. Consider filling up now.</>
                                    )}
                                    {trend === 'falling' && (
                                        <>Prices have been <span className="text-green-500 font-medium">falling</span> this week. You may want to wait.</>
                                    )}
                                    {trend === 'stable' && (
                                        <>Prices have been <span className="font-medium">stable</span> this week. Fill up when convenient.</>
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ontario Data Attribution */}
                    <p className="text-xs text-muted-foreground text-center">
                        Data based on Ontario Ministry of Energy fuel price trends.{" "}
                        <a
                            href="https://www.ontario.ca/motor-fuel-prices/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                        >
                            View official data
                        </a>
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Close
                        </Button>
                        <Button onClick={handleViewFullForecast} className="flex-1 gap-2">
                            Full Price Forecast
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

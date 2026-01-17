import { useState, useCallback, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { PriceForecastChart } from "@/components/PriceForecastChart";
import { Button } from "@/components/ui/button";
import type { PricePoint } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Minus, ExternalLink, Info, Newspaper, RefreshCw, Clock } from "lucide-react";
import { getNewsAnalysis, NewsAnalysis, getPriceHistory, getPriceForecast, getRegions, refreshRealPrices } from "@/api/endpoints";
import { NewsInsightsModal } from "@/components/NewsInsightsModal";
import { AdBanner } from "@/components/promotions";
import { useCachedData } from "@/hooks";


const ONTARIO_REGIONS = [
  { id: "toronto", name: "Toronto", basePrice: 1.42 },
  { id: "ottawa", name: "Ottawa", basePrice: 1.45 },
  { id: "hamilton", name: "Hamilton", basePrice: 1.39 },
  { id: "london", name: "London", basePrice: 1.40 },
  { id: "kitchener", name: "Kitchener-Waterloo", basePrice: 1.38 },
  { id: "thunder-bay", name: "Thunder Bay", basePrice: 1.52 },
  { id: "sudbury", name: "Sudbury", basePrice: 1.49 },
];

export function Prices() {
  const [regions, setRegions] = useState(ONTARIO_REGIONS);
  const [selectedRegion, setSelectedRegion] = useState(ONTARIO_REGIONS[0]);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);

  // Fetch regions on mount
  useEffect(() => {
    getRegions()
      .then((data) => {
        if (data && data.length > 0) {
          // Map to format with basePrice logic if needed, or just use defaults for basePrice
          // For simple UI, we assume API returns {id, name}
          const mapped = data.map((r) => ({ ...r, basePrice: 1.5 })); // Default base
          setRegions(mapped);
          if (!selectedRegion) setSelectedRegion(mapped[0]);
        }
      })
      .catch(console.error);
  }, []);

  const loadPrices = useCallback(async (regionId: string) => {
    setLoading(true);
    try {
      const history = await getPriceHistory(regionId, 14);
      const forecast = await getPriceForecast(regionId, 7);

      // Combine and sort
      const combined = [...history, ...forecast].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setPrices(combined);
    } catch (error) {
      console.error("Failed to load prices", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNews = useCallback(() => getNewsAnalysis(selectedRegion.id), [selectedRegion.id]);
  const {
    data: newsAnalysis,
    isLoading: newsLoading,
    isStale,
    lastUpdated,
    refresh: refreshNews
  } = useCachedData<NewsAnalysis>(
    `news-analysis-${selectedRegion.id}`,
    fetchNews,
    { ttlMs: 5 * 60 * 1000 } // 5 minutes cache
  );

  const handleRegionChange = (regionId: string) => {
    const region = regions.find(r => r.id === regionId) || regions[0];
    setSelectedRegion(region);
    loadPrices(regionId);
  };

  const refreshPrices = () => {
    loadPrices(selectedRegion.id);
  };

  useEffect(() => {
    loadPrices(selectedRegion.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion.id]);

  const todayPrice = prices.find(p => !p.is_forecast &&
    format(new Date(p.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))?.price || selectedRegion.basePrice;
  const weekAgoPrice = prices[0]?.price || todayPrice;
  const weekChange = ((todayPrice - weekAgoPrice) / weekAgoPrice) * 100;
  const forecastPrices = prices.filter(p => p.is_forecast);
  const avgForecast = forecastPrices.length > 0
    ? forecastPrices.reduce((sum, p) => sum + p.price, 0) / forecastPrices.length
    : todayPrice; // Default to today's price if no forecast data
  const trendDirection = avgForecast > todayPrice ? 'rising' : avgForecast < todayPrice - 0.01 ? 'falling' : 'stable';

  /* End Stats Calculation */

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshRealPrices();
      await loadPrices(selectedRegion.id);
      refreshNews();
    } catch (error) {
      console.error("Failed to refresh real data", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ontario Fuel Prices</h2>
            <p className="text-muted-foreground">
              Historical prices and AI-powered forecast
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="w-full md:w-[250px]">
              <Label className="mb-2 block">Ontario Region</Label>
              <Select value={selectedRegion.id} onValueChange={handleRegionChange}>
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
            </div>

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Fetch Live Data
            </Button>
          </div>
        </div>

        {/* AI Market Insights Card */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                AI Market Insights
                {isStale && (
                  <span className="text-xs font-normal text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                    Cached
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(lastUpdated, 'HH:mm')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshNews}
                  disabled={newsLoading}
                  title="Refresh insights"
                >
                  <RefreshCw className={`h-4 w-4 ${newsLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNewsModal(true)}
                  disabled={!newsAnalysis}
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <CardDescription>Based on latest oil & gas news analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {newsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing news sources...
              </div>
            ) : newsAnalysis ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    switch (newsAnalysis.prediction) {
                      case 'rising':
                        return <TrendingUp className="h-5 w-5 text-red-500" />;
                      case 'falling':
                        return <TrendingDown className="h-5 w-5 text-green-500" />;
                      default:
                        return <Minus className="h-5 w-5 text-muted-foreground" />;
                    }
                  })()}
                  <span className={`text-xl font-bold capitalize ${newsAnalysis.prediction === 'rising' ? 'text-red-500' :
                    newsAnalysis.prediction === 'falling' ? 'text-green-500' : 'text-muted-foreground'
                    }`}>
                    Prices likely to {newsAnalysis.prediction}
                  </span>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {Math.round(newsAnalysis.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  "{newsAnalysis.summary}"
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Based on {newsAnalysis.sources.length} news sources</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setShowNewsModal(true)}
                  >
                    View sources →
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load market insights</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Current Average</CardTitle>
              <CardDescription>{selectedRegion.name} - Regular Unleaded</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${todayPrice.toFixed(2)}/L</div>
              <p className={`text-xs mt-1 ${weekChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {weekChange > 0 ? '+' : ''}{weekChange.toFixed(1)}% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lowest in Region</CardTitle>
              <CardDescription>Nearby Stations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${(todayPrice - 0.06).toFixed(2)}/L</div>
              <p className="text-xs text-muted-foreground mt-1">
                Costco - {selectedRegion.name}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7-Day Forecast</CardTitle>
              <CardDescription>Historical trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-2 ${trendDirection === 'rising' ? 'text-red-500' :
                trendDirection === 'falling' ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                {trendDirection === 'rising' && <TrendingUp className="h-5 w-5" />}
                {trendDirection === 'falling' && <TrendingDown className="h-5 w-5" />}
                {trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg forecast: ${avgForecast.toFixed(2)}/L
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Price Chart */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Price History & Forecast</CardTitle>
            <CardDescription>
              Past 14 days and 7-day forecast for {selectedRegion.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceForecastChart
              prices={prices}
              currency="$"
              unit="L"
            />
          </CardContent>
        </Card>

        {/* Sponsored Content */}
        <div className="flex justify-center">
          <AdBanner slot="prices-leaderboard" format="leaderboard" />
        </div>

        {/* Data source attribution */}
        <div className="text-center">
          <a
            href="https://www.ontario.ca/motor-fuel-prices/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            Data based on Ontario Ministry of Energy fuel price reports
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* News Insights Modal */}
      <NewsInsightsModal
        analysis={newsAnalysis}
        isOpen={showNewsModal}
        onClose={() => setShowNewsModal(false)}
      />
    </Layout>
  );
}

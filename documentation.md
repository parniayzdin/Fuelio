# Gas Prices Map & Forecast Features

## Overview

The Fuel Up Advisor app includes two main features for tracking gas prices across Ontario:

1. **Gas Prices Map** - Interactive Google Maps showing real-time station prices
2. **Price Forecast** - Historical trends and 7-day price predictions by region

---

## Gas Prices Map (`/map`)

### Features

| Feature | Description |
|---------|-------------|
| **Interactive Map** | Google Maps centered on Ontario with zoom/pan |
| **Station Markers** | Color-coded circles showing current price |
| **Locate Me** | Button to center map on your location |
| **Refresh Prices** | Update prices in real-time |
| **Station List** | Sorted by price with quick navigation |

### Color Legend

| Color | Price Range | Meaning |
|-------|-------------|---------|
| 🟢 Green | < $1.40/L | Cheap |
| 🟡 Yellow | $1.40 - $1.50/L | Average |
| 🔴 Red | > $1.50/L | Expensive |

### Clicking a Station

When you click a station marker:
1. **Info popup** shows brand, address, and prices
2. **"View Price Forecast"** button opens detailed modal
3. Modal displays 7-day price history chart and trend

### Configuration

Add your Google Maps API key to `.env`:
```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

---

## Station Forecast Modal

Opens when clicking "View Price Forecast" on a station.

### Contents

- **Current Prices**: Regular, Premium, Diesel
- **7-Day Chart**: Bar chart of recent prices
- **Trend Badge**: Rising (red), Falling (green), or Stable
- **Recommendation**: Fill up now vs. wait
- **Full Forecast Link**: Navigate to `/prices` page

---

## Price Forecast Page (`/prices`)

### Ontario Regions

Select from 7 regions:
- Toronto (default)
- Ottawa
- Hamilton
- London
- Kitchener-Waterloo
- Thunder Bay
- Sudbury

### Stats Cards

| Card | Shows |
|------|-------|
| **Current Average** | Today's price + weekly change % |
| **Lowest in Region** | Cheapest station nearby |
| **7-Day Forecast** | Predicted trend direction |

### Price Chart

- **Solid line**: 14 days of historical prices
- **Dotted line**: 7-day forecast
- **Today marker**: Vertical line at current date

### Data Source

Prices are based on [Ontario Ministry of Energy fuel price reports](https://www.ontario.ca/motor-fuel-prices/).

---

## Technical Details

### Files

| File | Purpose |
|------|---------|
| `src/pages/GasMap.tsx` | Main map component with Google Maps |
| `src/pages/Prices.tsx` | Regional forecast page |
| `src/components/StationForecastModal.tsx` | Popup modal with chart |
| `src/components/PriceForecastChart.tsx` | Line chart component |

### Dependencies

```json
{
  "@react-google-maps/api": "^2.x",
  "date-fns": "^2.x",
  "recharts": "^2.x"
}
```

---

## Example Screenshots

### Gas Map with Markers
![Gas Map](/Users/karanvirkhanna/.gemini/antigravity/brain/5dde31b2-cd96-4102-8c2a-376ebb3627b6/.system_generated/click_feedback/click_feedback_1768373705354.png)

### Forecast Modal
![Forecast Modal](/Users/karanvirkhanna/.gemini/antigravity/brain/5dde31b2-cd96-4102-8c2a-376ebb3627b6/forecast_modal_view_1768373731460.png)

### Price Forecast Page
![Prices Page](/Users/karanvirkhanna/.gemini/antigravity/brain/5dde31b2-cd96-4102-8c2a-376ebb3627b6/prices_page_view_1768373762929.png)

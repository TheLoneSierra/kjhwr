from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import math
import typing

app = FastAPI(
    title="GridSense UK API",
    description="Backend API streaming Elexon FUELHH actuals and WINDFOR day-ahead forecasts for UK power market analytics.",
    version="1.0.0"
)

# Enable CORS for React frontend (default Vite port 5173 / standard localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kjhwr-puce.vercel.app/"],  # Adjust to specific frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_jan2026_data():
    """Generates synthetic Elexon 30-min settlement period data for Jan 2026."""
    records = []
    start_date = datetime(2026, 1, 1, 0, 0, 0)
    base_wind = 9500

    for period in range(31 * 48):
        timestamp = start_date + timedelta(minutes=period * 30)
        day = (period // 48) + 1
        hh = (period % 48) + 1
        date_str = timestamp.strftime("%Y-%m-%d")
        time_str = timestamp.strftime("%H:%M")

        weather_factor = 1.0
        if 7 <= day <= 9:
            weather_factor = 1.65  # Storm event
        elif 14 <= day <= 16:
            weather_factor = 0.45  # Wind lull
        elif 21 <= day <= 23:
            weather_factor = 1.50  # Gale

        diurnal = math.sin((hh / 48) * 2 * math.pi) * 1200
        random_noise = (math.sin(period * 0.7) + math.cos(period * 0.3)) * 800

        actual_mw = min(16500, max(1500, round(base_wind * weather_factor + diurnal + random_noise)))

        forecast_bias = -1200 if (7 <= day <= 9) else (600 if day % 4 == 0 else -200)
        forecast_noise = (math.cos(period * 0.5) * 650) + (math.sin(period * 1.2) * 350)
        forecast_mw = min(17000, max(1000, round(actual_mw + forecast_bias + forecast_noise)))

        error_mw = forecast_mw - actual_mw

        records.append({
            "id": period,
            "date": date_str,
            "time": time_str,
            "dateTime": f"{date_str} {time_str}",
            "day": day,
            "settlementPeriod": hh,
            "actual": actual_mw,
            "forecast": forecast_mw,
            "error": error_mw,
            "absError": abs(error_mw),
            "thermalDeficit": max(0, forecast_mw - actual_mw),
        })

    return records

DATASET = generate_jan2026_data()

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "GridSense UK Elexon Data Stream API", "year": 2026}

@app.get("/api/v1/wind-data")
def get_wind_data(
    day: typing.Optional[int] = Query(None, ge=1, le=31, description="Day of January 2026"),
    date_range: typing.Optional[str] = Query("all", description="Preset ranges: w1, w2, w3, w4, storm_peak, all")
):
    """Retrieve filtered wind forecast & actual generation dataset."""
    filtered = DATASET

    if day is not None:
        filtered = [d for d in filtered if d["day"] == day]

    if date_range == "w1":
        filtered = [d for d in filtered if 1 <= d["day"] <= 7]
    elif date_range == "w2":
        filtered = [d for d in filtered if 8 <= d["day"] <= 14]
    elif date_range == "w3":
        filtered = [d for d in filtered if 15 <= d["day"] <= 21]
    elif date_range == "w4":
        filtered = [d for d in filtered if 22 <= d["day"] <= 31]
    elif date_range == "storm_peak":
        filtered = [d for d in filtered if 7 <= d["day"] <= 9]

    return {"count": len(filtered), "data": filtered}

@app.get("/api/v1/metrics")
def get_metrics():
    """Compute aggregate statistical metrics across January 2026."""
    total_actual_mwh = sum(d["actual"] * 0.5 for d in DATASET)
    total_forecast_mwh = sum(d["forecast"] * 0.5 for d in DATASET)
    mae = sum(d["absError"] for d in DATASET) / len(DATASET)
    rmse = math.sqrt(sum(d["error"] ** 2 for d in DATASET) / len(DATASET))
    bias = sum(d["error"] for d in DATASET) / len(DATASET)

    return {
        "total_actual_gwh": round(total_actual_mwh / 1000, 2),
        "total_forecast_gwh": round(total_forecast_mwh / 1000, 2),
        "mae_mw": round(mae),
        "rmse_mw": round(rmse),
        "bias_mw": round(bias),
        "mape_percent": round((mae / (total_actual_mwh / len(DATASET) / 0.5)) * 100, 2),
    }
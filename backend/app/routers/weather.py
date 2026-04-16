from __future__ import annotations
"""Real weather data from GPS coordinates via Open-Meteo (free, no API key)."""

import urllib.request
import urllib.parse
import json

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/weather", tags=["weather"])

# WMO Weather Code → human description
WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def _wmo_to_visibility(code: int) -> str:
    if code in (45, 48):
        return "foggy"
    if code in (51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82):
        return "rainy"
    if code in (71, 73, 75, 77, 85, 86):
        return "snowy"
    if code in (95, 96, 99):
        return "stormy"
    return "clear"


def _wmo_to_moisture(code: int, precipitation: float) -> str:
    if precipitation > 0.1:
        return "wet"
    if code >= 51 and code <= 99:
        return "wet"
    return "dry"


@router.get("/current")
async def current_weather(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """
    Get real-time weather conditions for the given GPS coordinates.

    Uses Open-Meteo (free, no API key required).
    Returns actual temperature, humidity, visibility, precipitation, etc.
    """
    try:
        params = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,visibility,is_day,wind_speed_10m,cloud_cover",
            "timezone": "auto",
        })
        url = f"https://api.open-meteo.com/v1/forecast?{params}"

        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode())

        current = data.get("current", {})
        code = int(current.get("weather_code", 0))
        precipitation = float(current.get("precipitation", 0))
        visibility_m = float(current.get("visibility", 10000))
        is_day = bool(current.get("is_day", 1))

        return {
            "source": "Open-Meteo (real-time)",
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "elevation_m": data.get("elevation"),
                "timezone": data.get("timezone"),
            },
            "observed_at": current.get("time"),
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "cloud_cover_pct": current.get("cloud_cover"),
            "precipitation_mm": precipitation,
            "visibility_m": visibility_m,
            "weather_code": code,
            "weather_description": WEATHER_CODES.get(code, f"Code {code}"),
            # Normalized fields matching our existing schema
            "time_of_day": "day" if is_day else "night",
            "moisture": _wmo_to_moisture(code, precipitation),
            "visibility": _wmo_to_visibility(code),
            "streetlight": "absent" if is_day else "uncertain",
        }
    except Exception as e:
        raise HTTPException(502, f"Weather API failed: {str(e)}")

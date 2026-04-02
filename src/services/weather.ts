interface CurrentWeather {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  pop: number; // probability of precipitation (0-100)
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  cityName: string;
}

// WMO weather interpretation code → OWM icon prefix + description
// Icon suffix "d" (day) or "n" (night) appended at call site.
const WMO_ICON: Record<number, string> = {
  0: '01', 1: '01', 2: '02', 3: '04',
  45: '50', 48: '50',
  51: '09', 53: '09', 55: '09', 56: '09', 57: '09',
  61: '10', 63: '10', 65: '10', 66: '10', 67: '10',
  71: '13', 73: '13', 75: '13', 77: '13',
  80: '09', 81: '09', 82: '09',
  85: '13', 86: '13',
  95: '11', 96: '11', 99: '11',
};

const WMO_DESC: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'icy fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'heavy freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'heavy freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'heavy showers',
  85: 'light snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail',
};

function wmoIcon(code: number, isDay: boolean): string {
  const prefix = WMO_ICON[code] ?? '03';
  return `${prefix}${isDay ? 'd' : 'n'}`;
}

function wmoDesc(code: number): string {
  return WMO_DESC[code] ?? 'unknown';
}

async function geocode(input: string): Promise<{ lat: number; lon: number; name: string } | null> {
  // If input looks like "City, ST" or "City, State", extract the city part for search
  // and use the state/admin1 for result matching
  const parts = input.split(',').map(s => s.trim());
  const cityQuery = parts[0];
  const stateHint = parts[1]?.toLowerCase() ?? '';

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=10&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const results: Array<{ name: string; latitude: number; longitude: number; country_code: string; admin1?: string }> = data?.results ?? [];
  if (!results.length) return null;

  // If a state hint was given, prefer results whose admin1 matches it
  let best = results[0];
  if (stateHint) {
    const match = results.find(r =>
      r.admin1?.toLowerCase().includes(stateHint) ||
      r.admin1?.toLowerCase().startsWith(stateHint.slice(0, 3))
    );
    if (match) best = match;
  }

  const label = best.admin1 ? `${best.name}, ${best.admin1}` : best.name;
  return { lat: best.latitude, lon: best.longitude, name: label };
}

export async function fetchWeather(location: string): Promise<WeatherData | null> {
  try {
    const loc = (location || '40.030157,-105.089434').trim();
    let lat: number, lon: number, cityName: string;

    // "lat,lon" format
    const latLonMatch = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/.exec(loc);
    if (latLonMatch) {
      lat = parseFloat(latLonMatch[1]);
      lon = parseFloat(latLonMatch[2]);
      cityName = loc;
    } else {
      const geo = await geocode(loc);
      if (!geo) {
        console.warn('Weather: geocoding failed for', loc);
        return null;
      }
      ({ lat, lon, name: cityName } = geo);
    }

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      forecast_days: '5',
      timezone: 'auto',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) {
      console.warn('Open-Meteo error:', res.status);
      return null;
    }
    const data = await res.json();

    const c = data.current;
    const isDay = c.is_day === 1;
    const current: CurrentWeather = {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      description: wmoDesc(c.weather_code),
      icon: wmoIcon(c.weather_code, isDay),
      humidity: Math.round(c.relative_humidity_2m),
      windSpeed: Math.round(c.wind_speed_10m),
    };

    const d = data.daily;
    const forecast: ForecastDay[] = (d.time as string[]).map((date: string, i: number) => ({
      date,
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      description: wmoDesc(d.weather_code[i]),
      icon: wmoIcon(d.weather_code[i], true),
      humidity: Math.round(d.relative_humidity_2m_mean[i] ?? 0),
      windSpeed: Math.round(d.wind_speed_10m_max[i] ?? 0),
      pop: Math.round(d.precipitation_probability_max[i] ?? 0),
    }));

    return { current, forecast, cityName };
  } catch {
    return null;
  }
}

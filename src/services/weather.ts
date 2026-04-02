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
}

export async function fetchWeather(
  apiKey: string,
  location: string,
): Promise<WeatherData | null> {
  try {
    // Build query — use city name if provided, otherwise try lat/lon
    let query = '';
    if (location.trim()) {
      const loc = location.trim();
      // Detect OpenWeatherMap city ID (4–7 digit number)
      if (/^\d{4,7}$/.test(loc)) {
        query = `id=${loc}`;
      // Detect US zip code (5-digit or 5+4)
      } else if (/^\d{5}(-\d{4})?$/.test(loc)) {
        query = `zip=${loc},US`;
      } else {
        query = `q=${encodeURIComponent(loc)}`;
      }
    } else {
      // No location set — fall back to Erie, CO
      query = 'id=5576859';
    }

    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?${query}&units=imperial&appid=${apiKey}`,
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?${query}&units=imperial&appid=${apiKey}`,
      ),
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      console.warn('Weather API error:', currentRes.status, forecastRes.status);
      return null;
    }

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    const current: CurrentWeather = {
      temp: Math.round(currentData.main.temp),
      feelsLike: Math.round(currentData.main.feels_like),
      description: currentData.weather[0].description,
      icon: currentData.weather[0].icon,
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed),
    };

    // Group the 3-hour forecast entries by calendar date
    const dailyMap = new Map<
      string,
      { temps: number[]; descriptions: string[]; icons: string[]; humidities: number[]; winds: number[]; pops: number[] }
    >();

    for (const entry of forecastData.list as Array<{
      dt_txt: string;
      main: { temp: number; humidity: number };
      weather: Array<{ description: string; icon: string }>;
      wind: { speed: number };
      pop: number;
    }>) {
      const date = entry.dt_txt.split(' ')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { temps: [], descriptions: [], icons: [], humidities: [], winds: [], pops: [] });
      }
      const day = dailyMap.get(date)!;
      day.temps.push(entry.main.temp);
      day.descriptions.push(entry.weather[0].description);
      day.icons.push(entry.weather[0].icon);
      day.humidities.push(entry.main.humidity);
      day.winds.push(entry.wind.speed);
      day.pops.push(entry.pop ?? 0);
    }

    const forecast: ForecastDay[] = [...dailyMap.entries()]
      .slice(0, 5)
      .map(([date, day]) => ({
        date,
        tempMin: Math.round(Math.min(...day.temps)),
        tempMax: Math.round(Math.max(...day.temps)),
        description: day.descriptions[Math.floor(day.descriptions.length / 2)],
        icon: day.icons[Math.floor(day.icons.length / 2)],
        humidity: Math.round(day.humidities.reduce((a, b) => a + b, 0) / day.humidities.length),
        windSpeed: Math.round(day.winds.reduce((a, b) => a + b, 0) / day.winds.length),
        pop: Math.round(Math.max(...day.pops) * 100),
      }));

    return { current, forecast };
  } catch {
    return null;
  }
}

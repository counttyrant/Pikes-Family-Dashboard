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

    // Fetch current weather first to get lat/lon for One Call API
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}&units=imperial&appid=${apiKey}`,
    );
    if (!currentRes.ok) {
      console.warn('Weather API error:', currentRes.status);
      return null;
    }
    const currentData = await currentRes.json();

    const { lat, lon } = currentData.coord as { lat: number; lon: number };

    // Fetch 3-hour forecast (fallback) and One Call 3.0 (accurate daily) in parallel
    const [forecastRes, oneCallRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?${query}&units=imperial&appid=${apiKey}`,
      ),
      fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=current,minutely,hourly,alerts&units=imperial&appid=${apiKey}`,
      ).catch(() => null),
    ]);

    if (!forecastRes.ok) {
      console.warn('Forecast API error:', forecastRes.status);
      return null;
    }

    const currentDataMain = currentData;
    const forecastData = await forecastRes.json();

    const current: CurrentWeather = {
      temp: Math.round(currentDataMain.main.temp),
      feelsLike: Math.round(currentDataMain.main.feels_like),
      description: currentDataMain.weather[0].description,
      icon: currentDataMain.weather[0].icon,
      humidity: currentDataMain.main.humidity,
      windSpeed: Math.round(currentDataMain.wind.speed),
    };

    const cityName: string = currentDataMain.name ?? '';

    // Try One Call 3.0 for accurate daily min/max (same data source as OWM website)
    let oneCallDailyMap: Map<string, { tempMin: number; tempMax: number; description: string; icon: string; humidity: number; windSpeed: number; pop: number }> | null = null;
    if (oneCallRes && oneCallRes.ok) {
      try {
        const oneCallData = await oneCallRes.json();
        if (Array.isArray(oneCallData.daily)) {
          oneCallDailyMap = new Map();
          for (const day of oneCallData.daily as Array<{
            dt: number;
            temp: { min: number; max: number; day: number };
            weather: Array<{ description: string; icon: string }>;
            humidity: number;
            wind_speed: number;
            pop: number;
          }>) {
            const date = new Date(day.dt * 1000).toISOString().slice(0, 10);
            oneCallDailyMap.set(date, {
              tempMin: Math.round(day.temp.min),
              tempMax: Math.round(day.temp.max),
              description: day.weather[0].description,
              icon: day.weather[0].icon,
              humidity: Math.round(day.humidity),
              windSpeed: Math.round(day.wind_speed),
              pop: Math.round((day.pop ?? 0) * 100),
            });
          }
        }
      } catch {
        oneCallDailyMap = null;
      }
    }

    // Group the 3-hour forecast entries by calendar date (used as fallback)
    const dailyMap = new Map<
      string,
      { temps: number[]; noonEntry?: { description: string; icon: string }; descriptions: string[]; icons: string[]; humidities: number[]; winds: number[]; pops: number[] }
    >();

    for (const entry of forecastData.list as Array<{
      dt_txt: string;
      main: { temp: number; humidity: number };
      weather: Array<{ description: string; icon: string }>;
      wind: { speed: number };
      pop: number;
    }>) {
      const [date, time] = entry.dt_txt.split(' ');
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
      // Prefer the noon (12:00:00) entry for icon/description — matches OWM website
      if (time === '12:00:00') {
        day.noonEntry = { description: entry.weather[0].description, icon: entry.weather[0].icon };
      }
    }

    const forecast: ForecastDay[] = [...dailyMap.entries()]
      .slice(0, 5)
      .map(([date, day]) => {
        // If One Call 3.0 succeeded, use its accurate daily min/max, icon, description
        const onecall = oneCallDailyMap?.get(date);
        if (onecall) {
          return {
            date,
            tempMin: onecall.tempMin,
            tempMax: onecall.tempMax,
            description: onecall.description,
            icon: onecall.icon,
            humidity: onecall.humidity,
            windSpeed: onecall.windSpeed,
            pop: onecall.pop,
          };
        }

        // Fallback: compute from 3-hour slots (may miss overnight/morning extremes)
        const repDesc = day.noonEntry?.description ?? day.descriptions[Math.floor(day.descriptions.length * 0.6)];
        const repIcon = day.noonEntry?.icon ?? day.icons[Math.floor(day.icons.length * 0.6)];

        return {
          date,
          tempMin: Math.round(Math.min(...day.temps)),
          tempMax: Math.round(Math.max(...day.temps)),
          description: repDesc,
          icon: repIcon,
          humidity: Math.round(day.humidities.reduce((a, b) => a + b, 0) / day.humidities.length),
          windSpeed: Math.round(day.winds.reduce((a, b) => a + b, 0) / day.winds.length),
          pop: Math.round(Math.max(...day.pops) * 100),
        };
      });

    return { current, forecast, cityName };
  } catch {
    return null;
  }
}

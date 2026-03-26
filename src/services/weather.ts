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
    const encoded = encodeURIComponent(location);

    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encoded}&units=imperial&appid=${apiKey}`,
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encoded}&units=imperial&appid=${apiKey}`,
      ),
    ]);

    if (!currentRes.ok || !forecastRes.ok) return null;

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
      { temps: number[]; descriptions: string[]; icons: string[] }
    >();

    for (const entry of forecastData.list as Array<{
      dt_txt: string;
      main: { temp: number };
      weather: Array<{ description: string; icon: string }>;
    }>) {
      const date = entry.dt_txt.split(' ')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { temps: [], descriptions: [], icons: [] });
      }
      const day = dailyMap.get(date)!;
      day.temps.push(entry.main.temp);
      day.descriptions.push(entry.weather[0].description);
      day.icons.push(entry.weather[0].icon);
    }

    const forecast: ForecastDay[] = [...dailyMap.entries()]
      .slice(0, 5)
      .map(([date, day]) => ({
        date,
        tempMin: Math.round(Math.min(...day.temps)),
        tempMax: Math.round(Math.max(...day.temps)),
        description: day.descriptions[Math.floor(day.descriptions.length / 2)],
        icon: day.icons[Math.floor(day.icons.length / 2)],
      }));

    return { current, forecast };
  } catch {
    return null;
  }
}

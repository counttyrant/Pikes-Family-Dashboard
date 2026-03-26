import { useState, useEffect, useCallback } from 'react';
import { CloudOff, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fetchWeather, type WeatherData } from '../../services/weather';

interface WeatherProps {
  apiKey: string;
  location: string;
}

const REFRESH_MS = 15 * 60 * 1000;

export function Weather({ apiKey, location }: WeatherProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(false);
    const result = await fetchWeather(apiKey, location);
    if (result) {
      setData(result);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [apiKey, location]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-white/50">
        <CloudOff className="w-12 h-12" />
        <p className="text-lg">Set up weather in settings</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-white/50">
        <CloudOff className="w-12 h-12" />
        <p className="text-lg">Unable to load weather</p>
        <p className="text-xs text-white/30 text-center max-w-[200px]">
          {!location
            ? 'Set a location in settings (e.g. "Denver, CO")'
            : 'Check your API key and location in settings'}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const iconUrl = (code: string) =>
    `https://openweathermap.org/img/wn/${code}@2x.png`;

  return (
    <div className="flex flex-col gap-4">
      {/* Current weather */}
      <div className="flex items-center gap-4">
        <img
          src={iconUrl(data.current.icon)}
          alt={data.current.description}
          className="w-20 h-20 -ml-3"
        />
        <div className="flex flex-col">
          <span className="text-5xl font-light text-white tabular-nums">
            {data.current.temp}°
          </span>
          <span className="text-sm text-white/50">
            Feels like {data.current.feelsLike}°
          </span>
        </div>
        <div className="ml-auto text-right">
          <p className="text-base text-white/80 capitalize">
            {data.current.description}
          </p>
          <p className="text-xs text-white/40">
            💧 {data.current.humidity}% &nbsp; 💨 {data.current.windSpeed} mph
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* 5-day forecast */}
      <div className="grid grid-cols-5 gap-2">
        {data.forecast.map((day) => {
          const dayName = format(parseISO(day.date), 'EEE');
          return (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 py-1"
            >
              <span className="text-xs font-medium text-white/60 uppercase">
                {dayName}
              </span>
              <img
                src={iconUrl(day.icon)}
                alt={day.description}
                className="w-10 h-10"
              />
              <div className="flex gap-1.5 text-sm tabular-nums">
                <span className="text-white font-medium">{day.tempMax}°</span>
                <span className="text-white/40">{day.tempMin}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

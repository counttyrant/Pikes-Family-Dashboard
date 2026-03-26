import { useState, useEffect, useCallback } from 'react';
import { CloudOff, Loader2, X } from 'lucide-react';
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const detail = selectedDay !== null ? data.forecast[selectedDay] : null;

  return (
    <div className="flex flex-col gap-4 h-full">
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

      {/* Day detail overlay */}
      {detail && (
        <div className="bg-slate-700/80 rounded-xl p-3 border border-white/10 relative">
          <button
            onClick={() => setSelectedDay(null)}
            className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={14} className="text-white/50" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <img src={iconUrl(detail.icon)} alt={detail.description} className="w-12 h-12" />
            <div>
              <p className="text-base font-medium text-white">
                {format(parseISO(detail.date), 'EEEE, MMM d')}
              </p>
              <p className="text-sm text-white/60 capitalize">{detail.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">High</span>
              <span className="text-white font-medium">{detail.tempMax}°F</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Low</span>
              <span className="text-white font-medium">{detail.tempMin}°F</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">💧 Humidity</span>
              <span className="text-white font-medium">{detail.humidity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">💨 Wind</span>
              <span className="text-white font-medium">{detail.windSpeed} mph</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-white/50">🌧️ Rain chance</span>
              <span className="text-white font-medium">{detail.pop}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      <div className="grid grid-cols-5 gap-2">
        {data.forecast.map((day, idx) => {
          const dayName = format(parseISO(day.date), 'EEE');
          const isSelected = selectedDay === idx;
          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(isSelected ? null : idx)}
              className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all active:scale-95 ${
                isSelected
                  ? 'bg-white/15 ring-1 ring-white/20'
                  : 'hover:bg-white/10'
              }`}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

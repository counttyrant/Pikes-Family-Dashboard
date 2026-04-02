import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWeather, type WeatherData } from '../services/weather'

export function useWeather(location: string) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<WeatherData | null>(null)

  const refresh = useCallback(async () => {
    if (!location) return

    setLoading(true)
    setError(null)

    try {
      const result = await fetchWeather(location)
      if (result) {
        cacheRef.current = result
        setData(result)
      } else {
        setError('Failed to fetch weather data')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Weather fetch failed')
    } finally {
      setLoading(false)
    }
  }, [location])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  return {
    current: data?.current ?? null,
    forecast: data?.forecast ?? [],
    loading,
    error,
  }
}

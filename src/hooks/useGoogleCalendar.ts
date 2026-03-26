import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchCalendarEvents } from '../services/googleCalendar'
import type { CalendarEvent } from '../types'
import { startOfWeek, endOfWeek } from 'date-fns'

export function useGoogleCalendar(token: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const refresh = useCallback(async () => {
    if (!token) {
      setEvents([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
      const fetched = await fetchCalendarEvents(token, weekStart, weekEnd)
      setEvents(fetched)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch calendar')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  return { events, loading, error, refresh }
}

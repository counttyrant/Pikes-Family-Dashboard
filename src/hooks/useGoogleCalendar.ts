import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchCalendarEvents } from '../services/googleCalendar'
import type { CalendarEvent } from '../types'
import { startOfWeek, endOfWeek } from 'date-fns'

export function useGoogleCalendar(
  token: string | null,
  calendarIds: string[] = ['primary'],
) {
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

      // Fetch events from all selected calendars in parallel
      const ids = calendarIds.length > 0 ? calendarIds : ['primary']
      const results = await Promise.allSettled(
        ids.map((id) => fetchCalendarEvents(token, weekStart, weekEnd, id)),
      )

      const allEvents: CalendarEvent[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value)
        }
      }

      // Deduplicate by event id
      const seen = new Set<string>()
      const unique = allEvents.filter((e) => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })

      setEvents(unique)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch calendar')
    } finally {
      setLoading(false)
    }
  }, [token, calendarIds])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  return { events, loading, error, refresh }
}

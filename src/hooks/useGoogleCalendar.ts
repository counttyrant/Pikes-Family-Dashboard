import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchCalendarEvents } from '../services/googleCalendar'
import type { CalendarEvent } from '../types'
import { startOfWeek, startOfDay, addDays, subDays } from 'date-fns'

// The Calendar widget can render up to 14 days ahead (7/14-day views) and
// starts the week on either Sunday or Monday depending on settings, so the
// fetch window must be wider than any window the widget can display.
// Fetching only the current week meant that on the last day of the week
// (e.g. Sunday) no future events were ever loaded.
const DAYS_AHEAD = 35
const DAYS_BEHIND = 7

export function useGoogleCalendar(
  token: string | null,
  calendarIds: string[] = ['primary'],
) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Stabilize calendarIds to avoid re-creating refresh on every render
  const idsKey = JSON.stringify(calendarIds)
  const stableIds = useMemo(() => calendarIds, [idsKey])

  const refresh = useCallback(async () => {
    if (!token) {
      setEvents([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      // Start from the earliest day the widget could show (Sunday-start week),
      // with extra padding so past days of the current week stay populated.
      const timeMin = subDays(startOfWeek(startOfDay(now), { weekStartsOn: 0 }), DAYS_BEHIND)
      const timeMax = addDays(startOfDay(now), DAYS_AHEAD)

      const ids = stableIds.length > 0 ? stableIds : ['primary']
      const results = await Promise.allSettled(
        ids.map((id) => fetchCalendarEvents(token, timeMin, timeMax, id)),
      )

      const allEvents: CalendarEvent[] = []
      const errors: string[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value)
        } else {
          errors.push(result.reason?.message ?? 'Unknown error')
        }
      }

      // Only update events if we got at least some results,
      // or if ALL calendars succeeded (even if empty)
      if (allEvents.length > 0 || errors.length === 0) {
        const seen = new Set<string>()
        const unique = allEvents.filter((e) => {
          if (seen.has(e.id)) return false
          seen.add(e.id)
          return true
        })
        setEvents(unique)
      }

      // Report errors but don't clear events
      if (errors.length > 0) {
        setError(errors.join('; '))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch calendar')
      // Don't clear events on error — keep showing stale data
    } finally {
      setLoading(false)
    }
  }, [token, stableIds])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  return { events, loading, error, refresh }
}

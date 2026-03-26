import { useState, useEffect } from 'react'

export function useNightMode(startTime: string, endTime: string) {
  const [isNightMode, setIsNightMode] = useState(false)

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      if (startTime <= endTime) {
        setIsNightMode(hhmm >= startTime && hhmm < endTime)
      } else {
        // Overnight range, e.g. 22:00 to 06:00
        setIsNightMode(hhmm >= startTime || hhmm < endTime)
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [startTime, endTime])

  return { isNightMode }
}

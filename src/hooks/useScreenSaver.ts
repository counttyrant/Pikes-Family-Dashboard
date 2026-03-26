import { useState, useEffect, useCallback, useRef } from 'react'

export function useScreenSaver(timeoutSeconds: number) {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resetIdle = useCallback(() => {
    setIsIdle(false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutSeconds * 1000)
  }, [timeoutSeconds])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetIdle))
    resetIdle()

    return () => {
      clearTimeout(timerRef.current)
      events.forEach((e) => window.removeEventListener(e, resetIdle))
    }
  }, [resetIdle])

  return { isIdle, resetIdle }
}

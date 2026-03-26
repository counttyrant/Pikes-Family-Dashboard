import { useState, useEffect, useCallback } from 'react'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.()
  }, [])

  const exitFullscreen = useCallback(() => {
    document.exitFullscreen?.()
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      exitFullscreen()
    } else {
      enterFullscreen()
    }
  }, [enterFullscreen, exitFullscreen])

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen }
}

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseWakeLockReturn {
  isActive: boolean;
  acquire: () => Promise<void>;
  release: () => Promise<void>;
  isSupported: boolean;
}

export function useWakeLock(): UseWakeLockReturn {
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const releaseHandlerRef = useRef<(() => void) | null>(null);
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      if (releaseHandlerRef.current) {
        sentinelRef.current.removeEventListener('release', releaseHandlerRef.current);
        releaseHandlerRef.current = null;
      }
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const acquire = useCallback(async () => {
    if (!isSupported) return;
    try {
      // Remove old listener and release existing sentinel before acquiring a new one
      if (sentinelRef.current) {
        if (releaseHandlerRef.current) {
          sentinelRef.current.removeEventListener('release', releaseHandlerRef.current);
          releaseHandlerRef.current = null;
        }
        await sentinelRef.current.release();
        sentinelRef.current = null;
      }
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      // Store handler in ref so we can remove it on next acquire / release / unmount
      const handleRelease = () => {
        setIsActive(false);
        sentinelRef.current = null;
        releaseHandlerRef.current = null;
      };
      releaseHandlerRef.current = handleRelease;
      sentinelRef.current.addEventListener('release', handleRelease);
    } catch (err) {
      console.warn('[WakeLock] Could not acquire:', err);
      setIsActive(false);
    }
  }, [isSupported]);

  // Re-acquire the wake lock when the page becomes visible again
  // (the browser releases it automatically on hide)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive) {
        await acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, acquire, isSupported]);

  // Release on unmount
  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        if (releaseHandlerRef.current) {
          sentinelRef.current.removeEventListener('release', releaseHandlerRef.current);
        }
        sentinelRef.current.release().catch(() => {});
      }
    };
  }, []);

  return { isActive, acquire, release, isSupported };
}

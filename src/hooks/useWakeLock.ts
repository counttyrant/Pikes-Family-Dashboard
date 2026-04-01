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
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const acquire = useCallback(async () => {
    if (!isSupported) return;
    try {
      // Release any existing sentinel first
      if (sentinelRef.current) {
        await sentinelRef.current.release();
      }
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      sentinelRef.current.addEventListener('release', () => {
        setIsActive(false);
        sentinelRef.current = null;
      });
    } catch (err) {
      // Wake lock acquisition can fail if the document is hidden or battery is critically low
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
        sentinelRef.current.release().catch(() => {});
      }
    };
  }, []);

  return { isActive, acquire, release, isSupported };
}

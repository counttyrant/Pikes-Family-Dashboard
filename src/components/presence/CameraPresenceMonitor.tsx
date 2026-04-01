import { useEffect } from 'react';
import { useCameraPresence } from '../../hooks/useCameraPresence';
import { useWakeLock } from '../../hooks/useWakeLock';
import type { DashboardSettings } from '../../types';

interface CameraPresenceMonitorProps {
  settings: Pick<
    DashboardSettings,
    | 'presenceDetectionEnabled'
    | 'presenceSensitivity'
    | 'presenceInactivityTimeout'
    | 'presenceScheduleEnabled'
    | 'presenceScheduleStart'
    | 'presenceScheduleEnd'
  >;
}

/**
 * Invisible component that monitors the front camera for motion and keeps
 * the screen awake via the Web Wake Lock API when presence is detected.
 * Releases the wake lock after `presenceInactivityTimeout` minutes of no motion.
 */
export function CameraPresenceMonitor({ settings }: CameraPresenceMonitorProps) {
  const { acquire, release, isSupported } = useWakeLock();

  const { isRunning, permissionDenied } = useCameraPresence({
    enabled: settings.presenceDetectionEnabled && isSupported,
    sensitivity: settings.presenceSensitivity,
    idleAfterMs: settings.presenceInactivityTimeout * 60 * 1000,
    scheduleEnabled: settings.presenceScheduleEnabled,
    scheduleStart: settings.presenceScheduleStart,
    scheduleEnd: settings.presenceScheduleEnd,
    onMotion: () => {
      acquire();
    },
    onIdle: () => {
      release();
    },
  });

  // Log status for debugging (dev only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (permissionDenied) {
        console.warn('[CameraPresenceMonitor] Camera permission denied — presence detection disabled.');
      } else if (isRunning) {
        console.info('[CameraPresenceMonitor] Running — wake lock will activate on motion.');
      }
    }
  }, [isRunning, permissionDenied]);

  // This component renders nothing
  return null;
}

export default CameraPresenceMonitor;

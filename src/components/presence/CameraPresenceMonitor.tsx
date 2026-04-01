import { useEffect } from 'react';
import { useCameraPresence } from '../../hooks/useCameraPresence';
import { useMicPresence } from '../../hooks/useMicPresence';
import { useWakeLock } from '../../hooks/useWakeLock';
import type { DashboardSettings } from '../../types';

interface PresenceMonitorProps {
  settings: Pick<
    DashboardSettings,
    | 'presenceDetectionEnabled'
    | 'presenceSensitivity'
    | 'presenceInactivityTimeout'
    | 'presenceScheduleEnabled'
    | 'presenceScheduleStart'
    | 'presenceScheduleEnd'
    | 'presenceSource'
  >;
  onDim?: () => void;
  onUndim?: () => void;
}

/**
 * Invisible component that monitors for presence (via camera or microphone) and:
 * - Acquires a Wake Lock when presence is detected
 * - Releases the Wake Lock + calls onDim after the inactivity timeout
 * - Calls onUndim when presence is detected again
 */
export function PresenceMonitor({ settings, onDim, onUndim }: PresenceMonitorProps) {
  const { acquire, release, isSupported } = useWakeLock();

  const isEnabled = settings.presenceDetectionEnabled && isSupported;
  const useCamera = settings.presenceSource !== 'microphone';

  const handleMotion = () => {
    acquire();
    onUndim?.();
  };

  const handleIdle = () => {
    release();
    onDim?.();
  };

  const camera = useCameraPresence({
    enabled: isEnabled && useCamera,
    sensitivity: settings.presenceSensitivity,
    idleAfterMs: settings.presenceInactivityTimeout * 60 * 1000,
    scheduleEnabled: settings.presenceScheduleEnabled,
    scheduleStart: settings.presenceScheduleStart,
    scheduleEnd: settings.presenceScheduleEnd,
    onMotion: handleMotion,
    onIdle: handleIdle,
  });

  const mic = useMicPresence({
    enabled: isEnabled && !useCamera,
    sensitivity: settings.presenceSensitivity,
    idleAfterMs: settings.presenceInactivityTimeout * 60 * 1000,
    scheduleEnabled: settings.presenceScheduleEnabled,
    scheduleStart: settings.presenceScheduleStart,
    scheduleEnd: settings.presenceScheduleEnd,
    onMotion: handleMotion,
    onIdle: handleIdle,
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const { isRunning, permissionDenied } = useCamera ? camera : mic;
    if (permissionDenied) {
      console.warn(`[PresenceMonitor] ${useCamera ? 'Camera' : 'Mic'} permission denied.`);
    } else if (isRunning) {
      console.info(`[PresenceMonitor] Running (${useCamera ? 'camera' : 'mic'}).`);
    }
  }, [camera, mic, useCamera]);

  return null;
}

export { PresenceMonitor as CameraPresenceMonitor };
export default PresenceMonitor;

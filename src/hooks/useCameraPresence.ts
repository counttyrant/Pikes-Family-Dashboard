import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCameraPresenceOptions {
  /** 1 (most sensitive) to 10 (least sensitive). Default: 5 */
  sensitivity?: number;
  /** Milliseconds between frame comparisons. Default: 500 */
  interval?: number;
  /** Called when motion is detected */
  onMotion?: () => void;
  /** Called when no motion detected for `idleAfterMs` ms */
  onIdle?: () => void;
  /** Ms of no motion before onIdle fires. Default: 5 * 60 * 1000 (5 min) */
  idleAfterMs?: number;
  /** Whether detection is currently enabled */
  enabled?: boolean;
  /** If true, check schedule before running */
  scheduleEnabled?: boolean;
  /** Schedule start in "HH:MM" format */
  scheduleStart?: string;
  /** Schedule end in "HH:MM" format */
  scheduleEnd?: string;
}

interface UseCameraPresenceReturn {
  isRunning: boolean;
  permissionDenied: boolean;
  motionDetected: boolean;
}

/** Returns a 0-255 threshold from sensitivity 1–10 (inverted: 1 = very sensitive = low threshold) */
function sensitivityToThreshold(sensitivity: number): number {
  const clamped = Math.max(1, Math.min(10, sensitivity));
  // sensitivity 1 → threshold 8 (tiny pixel diff triggers motion)
  // sensitivity 10 → threshold 60 (only large movements trigger)
  return Math.round(8 + (clamped - 1) * (52 / 9));
}

/** Check if current time is within HH:MM–HH:MM range */
function isWithinSchedule(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight range (e.g. 22:00–06:00)
  return currentMins >= startMins || currentMins < endMins;
}

export function useCameraPresence({
  sensitivity = 5,
  interval = 500,
  onMotion,
  onIdle,
  idleAfterMs = 5 * 60 * 1000,
  enabled = true,
  scheduleEnabled = false,
  scheduleStart = '07:00',
  scheduleEnd = '22:00',
}: UseCameraPresenceOptions = {}): UseCameraPresenceReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevDataRef = useRef<Uint8ClampedArray | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMotionRef = useRef<number>(Date.now());

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    prevDataRef.current = null;
    setIsRunning(false);
    setMotionDetected(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (permissionDenied) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;

      // Create hidden video element
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
        video.playsInline = true;
        video.muted = true;
        document.body.appendChild(video);
        videoRef.current = video;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Create offscreen canvas for pixel diff
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      canvasRef.current.width = 80;
      canvasRef.current.height = 60;

      setIsRunning(true);
      setPermissionDenied(false);

      const threshold = sensitivityToThreshold(sensitivity);
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;

      timerRef.current = setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        // Check schedule
        if (scheduleEnabled && !isWithinSchedule(scheduleStart, scheduleEnd)) return;

        ctx.drawImage(videoRef.current, 0, 0, 80, 60);
        const { data } = ctx.getImageData(0, 0, 80, 60);

        if (prevDataRef.current) {
          let diffSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            diffSum += Math.abs(data[i] - prevDataRef.current[i])       // R
                     + Math.abs(data[i + 1] - prevDataRef.current[i + 1]) // G
                     + Math.abs(data[i + 2] - prevDataRef.current[i + 2]); // B
          }
          const avgDiff = diffSum / (data.length / 4 * 3);

          if (avgDiff > threshold) {
            lastMotionRef.current = Date.now();
            setMotionDetected(true);
            onMotion?.();

            // Reset idle timer on each motion event
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
              setMotionDetected(false);
              onIdle?.();
            }, idleAfterMs);
          }
        }

        prevDataRef.current = new Uint8ClampedArray(data);
      }, interval);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        console.warn('[CameraPresence] Camera permission denied');
        setPermissionDenied(true);
      } else {
        console.warn('[CameraPresence] Camera error:', err);
      }
      setIsRunning(false);
    }
  }, [
    sensitivity, interval, onMotion, onIdle, idleAfterMs,
    permissionDenied, scheduleEnabled, scheduleStart, scheduleEnd,
  ]);

  useEffect(() => {
    if (enabled && !permissionDenied) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Clean up video element on full unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);

  return { isRunning, permissionDenied, motionDetected };
}

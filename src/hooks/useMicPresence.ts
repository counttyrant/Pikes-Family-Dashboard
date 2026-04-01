import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMicPresenceOptions {
  /** 1 (most sensitive) to 10 (least sensitive). Default: 5 */
  sensitivity?: number;
  /** Milliseconds between volume checks. Default: 500 */
  interval?: number;
  /** Called when sound is detected above threshold */
  onMotion?: () => void;
  /** Called when no sound detected for `idleAfterMs` ms */
  onIdle?: () => void;
  /** Ms of silence before onIdle fires. Default: 5 * 60 * 1000 (5 min) */
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

interface UseMicPresenceReturn {
  isRunning: boolean;
  permissionDenied: boolean;
  soundDetected: boolean;
}

/** Maps sensitivity 1–10 to a 0–255 RMS threshold (inverted: 1 = very sensitive) */
function sensitivityToThreshold(sensitivity: number): number {
  const clamped = Math.max(1, Math.min(10, sensitivity));
  // sensitivity 1 -> threshold 4  (whisper triggers it)
  // sensitivity 10 -> threshold 40 (only loud sounds trigger)
  return Math.round(4 + (clamped - 1) * (36 / 9));
}

/** Check if current time is within HH:MM–HH:MM range (supports overnight) */
function isWithinSchedule(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function useMicPresence({
  sensitivity = 5,
  interval = 500,
  onMotion,
  onIdle,
  idleAfterMs = 5 * 60 * 1000,
  enabled = true,
  scheduleEnabled = false,
  scheduleStart = '07:00',
  scheduleEnd = '22:00',
}: UseMicPresenceOptions = {}): UseMicPresenceReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [soundDetected, setSoundDetected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopMic = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    analyserRef.current = null;
    setIsRunning(false);
    setSoundDetected(false);
  }, []);

  const startMic = useCallback(async () => {
    if (permissionDenied) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const threshold = sensitivityToThreshold(sensitivity);

      setIsRunning(true);

      timerRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        if (scheduleEnabled && !isWithinSchedule(scheduleStart, scheduleEnd)) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS of frequency data
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) sumSq += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sumSq / dataArray.length);

        if (rms > threshold) {
          setSoundDetected(true);
          onMotion?.();

          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(() => {
            setSoundDetected(false);
            onIdle?.();
          }, idleAfterMs);
        }
      }, interval);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        console.warn('[MicPresence] Microphone permission denied');
        setPermissionDenied(true);
      } else {
        console.warn('[MicPresence] Mic error:', err);
      }
      setIsRunning(false);
    }
  }, [sensitivity, interval, onMotion, onIdle, idleAfterMs, permissionDenied, scheduleEnabled, scheduleStart, scheduleEnd]);

  useEffect(() => {
    if (enabled && !permissionDenied) {
      startMic();
    } else {
      stopMic();
    }
    return () => stopMic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isRunning, permissionDenied, soundDetected };
}

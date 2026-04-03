import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMicLevelReturn {
  /** Current RMS level 0–255 */
  level: number;
  isRunning: boolean;
  permissionDenied: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Lightweight hook that opens the microphone and emits the current RMS level
 * every 100ms. Intended for settings panel VU meters — does not include any
 * presence/idle/wake logic.
 */
export function useMicLevel(): UseMicLevelReturn {
  const [level, setLevel] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (isRunning || permissionDenied) return;
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

      setIsRunning(true);

      timerRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) sumSq += dataArray[i] * dataArray[i];
        setLevel(Math.round(Math.sqrt(sumSq / dataArray.length)));
      }, 100);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      setIsRunning(false);
    }
  }, [isRunning, permissionDenied]);

  // Clean up on unmount
  useEffect(() => () => stop(), [stop]);

  return { level, isRunning, permissionDenied, start, stop };
}

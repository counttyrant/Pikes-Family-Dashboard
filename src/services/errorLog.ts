/**
 * Lightweight error log for the wall-mounted kiosk.
 *
 * The hub runs unattended, so failures that are only written to the live
 * console are lost by the time anyone looks. Entries are mirrored to
 * console.error and kept in a capped localStorage ring buffer that survives
 * reloads. Intentionally has no UI — read it from DevTools with:
 *
 *   JSON.parse(localStorage.getItem('dashboard:errorLog'))
 */

const STORAGE_KEY = 'dashboard:errorLog';
const MAX_ENTRIES = 200;

export interface ErrorLogEntry {
  at: string;
  scope: string;
  message: string;
  detail?: unknown;
}

export function logError(scope: string, message: string, detail?: unknown): void {
  const entry: ErrorLogEntry = {
    at: new Date().toISOString(),
    scope,
    message,
    detail: detail instanceof Error ? detail.message : detail,
  };

  console.error(`[${scope}] ${message}`, detail ?? '');

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: ErrorLogEntry[] = raw ? JSON.parse(raw) : [];
    entries.push(entry);
    // Keep only the most recent entries so the kiosk can run for months
    // without growing localStorage without bound.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // localStorage full or unavailable — the console.error above still fired.
  }
}

export function readErrorLog(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

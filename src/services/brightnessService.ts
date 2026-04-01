const TIMEOUT_MS = 2000;

function buildUrl(port: number, path: string): string {
  return `http://localhost:${port}${path}`;
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Set the monitor brightness via the local brightness service.
 * Returns true on success, false if service is unreachable or errors.
 */
export async function setBrightness(level: number, port: number): Promise<boolean> {
  try {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const res = await fetchWithTimeout(buildUrl(port, '/brightness'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: clamped }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get the current brightness level (0–100) from the local brightness service.
 * Returns null if service is unreachable.
 */
export async function getBrightness(port: number): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(buildUrl(port, '/brightness'));
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.level === 'number' ? data.level : null;
  } catch {
    return null;
  }
}

/**
 * Check if the local brightness service is running.
 * Returns { ok: true, level } or { ok: false }.
 */
export async function checkBrightnessService(port: number): Promise<{ ok: boolean; level?: number }> {
  try {
    const res = await fetchWithTimeout(buildUrl(port, '/status'));
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, level: data.level };
  } catch {
    return { ok: false };
  }
}

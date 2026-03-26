/**
 * Cloud sync service — syncs local IndexedDB/localStorage data with
 * Azure Cosmos DB via the /api/data endpoints.
 *
 * Strategy: write-through (write to both local + cloud), read from local first.
 * On app start, pull from cloud and merge into local.
 */

const API_BASE = '/api/data';

interface CloudDocument {
  id: string;
  collection: string;
  _lastModified?: string;
  [key: string]: unknown;
}

// ── Low-level API helpers ──────────────────────────────────────────────

async function cloudGet(collection: string, id?: string): Promise<CloudDocument | CloudDocument[] | null> {
  const params = new URLSearchParams({ collection });
  if (id) params.set('id', id);

  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    console.warn(`Cloud GET ${collection}/${id ?? '*'} failed:`, res.status);
    return null;
  }
  return res.json();
}

async function cloudPut(collection: string, data: Record<string, unknown>): Promise<CloudDocument | null> {
  try {
    const res = await fetch(API_BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, collection }),
    });
    if (!res.ok) {
      console.warn(`Cloud PUT ${collection}/${data.id} failed:`, res.status);
      return null;
    }
    return res.json();
  } catch (err) {
    console.warn('Cloud PUT failed (offline?):', err);
    return null;
  }
}

async function cloudDelete(collection: string, id: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ collection, id });
    const res = await fetch(`${API_BASE}?${params}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch (err) {
    console.warn('Cloud DELETE failed (offline?):', err);
    return false;
  }
}

// ── High-level sync functions ──────────────────────────────────────────

/**
 * Push a single document to the cloud. Call after any local write.
 */
export async function syncToCloud(collection: string, data: Record<string, unknown> | object): Promise<void> {
  await cloudPut(collection, data as Record<string, unknown>);
}

/**
 * Delete a document from the cloud.
 */
export async function deleteFromCloud(collection: string, id: string): Promise<void> {
  await cloudDelete(collection, id);
}

/**
 * Pull all documents for a collection from the cloud.
 */
export async function pullFromCloud(collection: string): Promise<CloudDocument[]> {
  const result = await cloudGet(collection);
  if (Array.isArray(result)) return result;
  return [];
}

/**
 * Pull a single document from the cloud.
 */
export async function pullOneFromCloud(collection: string, id: string): Promise<CloudDocument | null> {
  const result = await cloudGet(collection, id);
  if (result && !Array.isArray(result)) return result;
  return null;
}

// ── localStorage sync (for widget data) ────────────────────────────────

export async function syncLocalStorageToCloud(key: string): Promise<void> {
  const value = localStorage.getItem(key);
  if (value !== null) {
    await cloudPut('localStorage', { id: key, value });
  }
}

export async function pullLocalStorageFromCloud(key: string): Promise<string | null> {
  const doc = await pullOneFromCloud('localStorage', key);
  if (doc && typeof doc.value === 'string') {
    localStorage.setItem(key, doc.value);
    return doc.value;
  }
  return null;
}

/**
 * Initialize: pull cloud data into localStorage for widget data.
 */
export async function initCloudSync(): Promise<boolean> {
  try {
    // Test if API is available
    const res = await fetch(`${API_BASE}?collection=settings&id=_ping`, {
      signal: AbortSignal.timeout(3000),
    });
    // 404 is fine (means API works but item doesn't exist)
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

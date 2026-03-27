const PROXY_BASE = '/api/immich-proxy';

async function proxyFetch(serverUrl: string, apiKey: string, path: string) {
  const url = serverUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ server: url, path, apiKey });
  const response = await fetch(`${PROXY_BASE}?${params}`);

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Immich API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchImmichAlbums(
  serverUrl: string,
  apiKey: string
): Promise<{ id: string; albumName: string; assetCount: number }[]> {
  const albums = await proxyFetch(serverUrl, apiKey, '/api/albums');
  return albums.map((album: { id: string; albumName: string; assetCount: number }) => ({
    id: album.id,
    albumName: album.albumName,
    assetCount: album.assetCount,
  }));
}

export async function removeFromImmichAlbum(
  serverUrl: string,
  apiKey: string,
  albumId: string,
  assetId: string
): Promise<void> {
  const url = serverUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    server: url,
    path: `/api/albums/${albumId}/assets`,
    apiKey,
  });
  const response = await fetch(`${PROXY_BASE}?${params}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [assetId] }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to remove asset: ${response.status}`);
  }
}

export async function toggleImmichFavorite(
  serverUrl: string,
  apiKey: string,
  assetId: string,
  isFavorite: boolean
): Promise<void> {
  const url = serverUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    server: url,
    path: `/api/assets/${assetId}`,
    apiKey,
  });
  const response = await fetch(`${PROXY_BASE}?${params}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isFavorite }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to toggle favorite: ${response.status}`);
  }
}

export async function fetchImmichAlbumPhotos(
  serverUrl: string,
  apiKey: string,
  albumId: string
): Promise<string[]> {
  try {
    const album = await proxyFetch(serverUrl, apiKey, `/api/albums/${albumId}`);
    const url = serverUrl.replace(/\/+$/, '');
    // Route thumbnails through proxy too — Immich requires x-api-key header for images
    return (album.assets ?? []).map(
      (asset: { id: string }) => {
        const params = new URLSearchParams({
          server: url,
          path: `/api/assets/${asset.id}/thumbnail?size=preview`,
          apiKey,
        });
        return `${PROXY_BASE}?${params}`;
      }
    );
  } catch (error) {
    console.warn('Failed to fetch Immich album photos:', error);
    return [];
  }
}

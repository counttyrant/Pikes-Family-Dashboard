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
    const url = serverUrl.replace(/\/+$/, '');

    // withoutAssets=false ensures assets array is included — some Immich versions
    // default to excluding them for performance on large albums.
    const album = await proxyFetch(serverUrl, apiKey, `/api/albums/${albumId}?withoutAssets=false`);

    let assets: { id: string; type?: string }[] = album.assets ?? [];

    // If fewer assets were returned than the album reports, use paginated fetch
    if (typeof album.assetCount === 'number' && assets.length < album.assetCount) {
      console.log(`[Immich] Album has ${album.assetCount} assets but only ${assets.length} were included in album response. Fetching all pages...`);
      assets = await fetchAllAlbumAssets(serverUrl, apiKey, albumId, album.assetCount);
    }

    // Filter to images only (exclude videos) and build proxied thumbnail URLs
    const imageUrls = assets
      .filter((asset) => !asset.type || asset.type === 'IMAGE' || asset.type === 'image')
      .map((asset) => {
        const params = new URLSearchParams({
          server: url,
          path: `/api/assets/${asset.id}/thumbnail?size=preview`,
          apiKey,
        });
        return `${PROXY_BASE}?${params}`;
      });

    console.log(`[Immich] Loaded ${imageUrls.length} image URLs (${assets.length} total assets in album)`);
    return imageUrls;
  } catch (error) {
    console.warn('Failed to fetch Immich album photos:', error);
    return [];
  }
}

/** Paginated fallback: fetches all assets from the album using smaller batches */
async function fetchAllAlbumAssets(
  serverUrl: string,
  apiKey: string,
  albumId: string,
  totalCount: number,
): Promise<{ id: string; type?: string }[]> {
  const PAGE_SIZE = 200;
  const pages = Math.ceil(totalCount / PAGE_SIZE);
  const all: { id: string; type?: string }[] = [];

  for (let page = 1; page <= pages && page <= 20; page++) {
    try {
      // Use the search/metadata endpoint which supports albumId + pagination in all Immich versions
      const data = await proxyFetch(
        serverUrl,
        apiKey,
        `/api/assets?albumId=${encodeURIComponent(albumId)}&page=${page}&size=${PAGE_SIZE}`,
      );
      const batch: { id: string; type?: string }[] = Array.isArray(data) ? data : [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    } catch {
      // If the paginated endpoint isn't supported, stop and return what we have
      break;
    }
  }

  return all;
}

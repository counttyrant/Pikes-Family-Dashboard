import { logError } from './errorLog';

const PROXY_BASE = '/api/immich-proxy';

type ProxyMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ProxyFetchOptions {
  method?: ProxyMethod;
  body?: unknown;
}

interface ImmichAssetSummary {
  id: string;
  type?: string;
}

function extractAssets(payload: any): ImmichAssetSummary[] {
  const rawAssets =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.assets?.items)
        ? payload.assets.items
        : Array.isArray(payload?.assets)
          ? payload.assets
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

  return rawAssets
    .map((asset: any) => ({
      id: typeof asset?.id === 'string' ? asset.id : '',
      type: typeof asset?.type === 'string' ? asset.type : undefined,
    }))
    .filter((asset: ImmichAssetSummary) => asset.id.length > 0);
}

async function proxyFetch(serverUrl: string, apiKey: string, path: string, options: ProxyFetchOptions = {}) {
  const url = serverUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ server: url, path, apiKey });
  const method = options.method ?? 'GET';
  const response = await fetch(`${PROXY_BASE}?${params}`, {
    method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

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
  await proxyFetch(serverUrl, apiKey, `/api/albums/${albumId}/assets`, {
    method: 'DELETE',
    body: { ids: [assetId] },
  });
}

export async function toggleImmichFavorite(
  serverUrl: string,
  apiKey: string,
  assetId: string,
  isFavorite: boolean
): Promise<void> {
  await proxyFetch(serverUrl, apiKey, `/api/assets/${assetId}`, {
    method: 'PUT',
    body: { isFavorite },
  });
}

export async function fetchImmichAlbumPhotos(
  serverUrl: string,
  apiKey: string,
  albumId: string
): Promise<string[] | null> {
  try {
    const url = serverUrl.replace(/\/+$/, '');

    // withoutAssets=false ensures assets array is included — some Immich versions
    // default to excluding them for performance on large albums.
    const album = await proxyFetch(serverUrl, apiKey, `/api/albums/${albumId}?withoutAssets=false`);

    let assets = extractAssets(album?.assets);

    // Immich reports the album size under different keys across versions.
    const reportedCount = [album?.assetCount, album?.assetsCount, album?.albumSize]
      .find((v) => typeof v === 'number') as number | undefined;

    // Newer Immich versions omit or truncate album.assets in album detail
    // responses. Previously the paginated fallback only ran when a numeric
    // assetCount was present and larger than the inline array — so a version
    // that returned a truncated array AND no assetCount silently produced a
    // small fixed subset of the album (the slideshow then looped those few
    // photos forever). Treat an unknown count as "must verify by paging".
    const incomplete =
      assets.length === 0 ||
      reportedCount === undefined ||
      assets.length < reportedCount;

    if (incomplete) {
      const paged = await fetchAllAlbumAssets(serverUrl, apiKey, albumId);
      if (paged.length > assets.length) {
        if (reportedCount === undefined) {
          logError(
            'Immich',
            `Album response did not report an asset count; inline list had ${assets.length} assets, paging recovered ${paged.length}.`,
          );
        } else {
          logError(
            'Immich',
            `Album reports ${reportedCount} assets but only ${assets.length} were inlined; paging recovered ${paged.length}.`,
          );
        }
        assets = paged;
      }
    }

    if (reportedCount !== undefined && assets.length < reportedCount) {
      logError(
        'Immich',
        `Only resolved ${assets.length} of ${reportedCount} album assets — slideshow will repeat a subset.`,
      );
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
    logError('Immich', 'Failed to fetch album photos — keeping previous photo list', error);
    return null;
  }
}

/** Paginated fallback: fetches all assets from the album using smaller batches */
async function fetchAllAlbumAssets(
  serverUrl: string,
  apiKey: string,
  albumId: string,
): Promise<ImmichAssetSummary[]> {
  const PAGE_SIZE = 200;
  const all: ImmichAssetSummary[] = [];

  for (let page = 1; page <= 20; page++) {
    try {
      // Newer Immich versions: album assets come from search/metadata
      const data = await proxyFetch(
        serverUrl,
        apiKey,
        '/api/search/metadata',
        {
          method: 'POST',
          body: { albumIds: [albumId], page, size: PAGE_SIZE },
        },
      );
      const batch = extractAssets(data);
      if (batch.length === 0) break;
      all.push(...batch);
      const nextPage = data?.assets?.nextPage;
      if (!nextPage || batch.length < PAGE_SIZE) break;
      continue;
    } catch {
      try {
        // Legacy fallback for older Immich versions
        const legacy = await proxyFetch(
          serverUrl,
          apiKey,
          `/api/assets?albumId=${encodeURIComponent(albumId)}&page=${page}&size=${PAGE_SIZE}`,
        );
        const batch = extractAssets(legacy);
        if (batch.length === 0) break;
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      } catch (err) {
        logError('Immich', `Paged album fetch failed at page ${page} (have ${all.length} assets so far)`, err);
        break;
      }
    }
  }

  return Array.from(new Map(all.map((asset) => [asset.id, asset])).values());
}

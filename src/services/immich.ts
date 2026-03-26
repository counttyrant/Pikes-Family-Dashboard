export async function fetchImmichAlbums(
  serverUrl: string,
  apiKey: string
): Promise<{ id: string; albumName: string; assetCount: number }[]> {
  const url = serverUrl.replace(/\/+$/, '');
  const response = await fetch(`${url}/api/albums`, {
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Immich API error: ${response.status} ${response.statusText}`);
  }

  const albums = await response.json();
  return albums.map((album: { id: string; albumName: string; assetCount: number }) => ({
    id: album.id,
    albumName: album.albumName,
    assetCount: album.assetCount,
  }));
}

export async function fetchImmichAlbumPhotos(
  serverUrl: string,
  apiKey: string,
  albumId: string
): Promise<string[]> {
  try {
    const response = await fetch(`${serverUrl}/api/albums/${albumId}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Immich API error: ${response.status} ${response.statusText}`);
    }

    const album = await response.json();
    return (album.assets ?? []).map(
      (asset: { id: string }) =>
        `${serverUrl}/api/assets/${asset.id}/thumbnail?size=preview&key=${apiKey}`
    );
  } catch (error) {
    console.warn('Failed to fetch Immich album photos:', error);
    return [];
  }
}

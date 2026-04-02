export async function fetchGooglePhotosAlbums(
  accessToken: string
): Promise<{ id: string; title: string; mediaItemsCount: string }[]> {
  try {
    const response = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Google Photos API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.albums ?? []).map(
      (album: { id: string; title: string; mediaItemsCount: string }) => ({
        id: album.id,
        title: album.title,
        mediaItemsCount: album.mediaItemsCount,
      })
    );
  } catch (error) {
    console.warn('Failed to fetch Google Photos albums:', error);
    return [];
  }
}

export async function fetchGooglePhotosAlbumImages(
  accessToken: string,
  albumId: string
): Promise<string[]> {
  try {
    const response = await fetch(
      'https://photoslibrary.googleapis.com/v1/mediaItems:search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ albumId, pageSize: 50 }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Photos API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.mediaItems ?? []).map(
      (item: { baseUrl: string }) => `${item.baseUrl}=w1280-h720`
    );
  } catch (error) {
    console.warn('Failed to fetch Google Photos album images:', error);
    return [];
  }
}

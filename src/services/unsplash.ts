export const DEFAULT_PHOTO_URLS: string[] = [
  'https://picsum.photos/id/10/1920/1080',
  'https://picsum.photos/id/15/1920/1080',
  'https://picsum.photos/id/29/1920/1080',
  'https://picsum.photos/id/37/1920/1080',
  'https://picsum.photos/id/47/1920/1080',
  'https://picsum.photos/id/57/1920/1080',
  'https://picsum.photos/id/76/1920/1080',
  'https://picsum.photos/id/84/1920/1080',
  'https://picsum.photos/id/106/1920/1080',
  'https://picsum.photos/id/119/1920/1080',
  'https://picsum.photos/id/134/1920/1080',
  'https://picsum.photos/id/155/1920/1080',
  'https://picsum.photos/id/167/1920/1080',
  'https://picsum.photos/id/190/1920/1080',
  'https://picsum.photos/id/210/1920/1080',
];

export async function fetchUnsplashPhotos(
  accessKey: string,
  count?: number
): Promise<string[]> {
  if (!accessKey) {
    return DEFAULT_PHOTO_URLS;
  }

  try {
    const photoCount = count || 10;
    const response = await fetch(
      `https://api.unsplash.com/photos/random?count=${photoCount}&orientation=landscape&query=nature,landscape,scenery`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
    }

    const photos = await response.json();
    return photos.map((photo: { urls: { regular: string } }) => photo.urls.regular);
  } catch (error) {
    console.warn('Failed to fetch Unsplash photos:', error);
    return DEFAULT_PHOTO_URLS;
  }
}

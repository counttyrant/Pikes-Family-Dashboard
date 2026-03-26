// Curated high-quality landscape photos — direct URLs that don't require redirects
export const DEFAULT_PHOTO_URLS: string[] = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1465056836900-8f1e940b3925?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1540206395-68808572332f?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1490682143684-14369e18dce8?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1431036101494-63e4fed5e9a0?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1505159940484-eb2b9f2588e2?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1484591974057-265bb767ef71?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=1920&h=1080&fit=crop',
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

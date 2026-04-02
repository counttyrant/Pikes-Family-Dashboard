import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { fetchImmichAlbumPhotos } from '../../services/immich';
import { fetchGooglePhotosAlbumImages } from '../../services/googlePhotos';
import { fetchUnsplashPhotos, DEFAULT_PHOTO_URLS } from '../../services/unsplash';
import type { PhotoSource, DashboardSettings } from '../../types';

const TRANSITION_MS = 1500;
// Max number of local photo blobs held in memory at once.
// Each decoded photo = ~8 MB GPU texture. 5 × 8 MB = ~40 MB vs loading all blobs at startup.
const MAX_BLOB_CACHE = 5;

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function extractImmichAssetId(url: string): string | null {
  try {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return null;
    const params = new URLSearchParams(url.slice(qIdx + 1));
    const path = params.get('path') || '';
    const match = path.match(/\/api\/assets\/([^/]+)\//);
    return match?.[1] || null;
  } catch { return null; }
}

export interface PhotoInfo {
  url: string;
  source: PhotoSource | 'default';
  localId?: string;
  immichAssetId?: string;
}

export interface PhotoSlideshowHandle {
  advance: () => void;
  previous: () => void;
  shuffle: () => void;
  getCurrentInfo: () => PhotoInfo | null;
  removeCurrentFromList: () => void;
}

interface Props {
  pictureMode?: boolean;
}

export const PhotoSlideshow = forwardRef<PhotoSlideshowHandle, Props>(function PhotoSlideshow({ pictureMode = false }, ref) {
  // Load only photo IDs — blobs are NOT loaded into memory until a photo is displayed.
  // Previously loading toArray() pulled every blob into the JS heap at startup.
  const localPhotoIds: string[] = (useLiveQuery<string[], string[]>(
    async () => {
      const keys = await db.photos.orderBy('addedAt').primaryKeys();
      return keys as string[];
    },
    [],
    [],
  )) ?? [];
  const dbSettings = useLiveQuery(() => db.settings.get('main'));

  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('local');
  const [slideInterval, setSlideInterval] = useState(15);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  // Resolved blob URL for the currently displayed local photo (populated on demand)
  const [resolvedDisplayUrl, setResolvedDisplayUrl] = useState<string | null>(null);

  const transitioningRef = useRef(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LRU blob URL cache: evicts + revokes oldest entry when full so at most
  // MAX_BLOB_CACHE decoded images are resident in memory at once.
  const blobCacheRef = useRef<Map<string, string>>(new Map());

  const getLocalBlobUrl = useCallback(async (id: string): Promise<string | null> => {
    const cache = blobCacheRef.current;
    if (cache.has(id)) {
      // LRU touch: move to end
      const url = cache.get(id)!;
      cache.delete(id);
      cache.set(id, url);
      return url;
    }
    const photo = await db.photos.get(id);
    if (!photo) return null;
    const url = URL.createObjectURL(photo.blob);
    // Evict oldest entries to stay within the cache limit
    while (cache.size >= MAX_BLOB_CACHE) {
      const oldestKey = cache.keys().next().value as string;
      URL.revokeObjectURL(cache.get(oldestKey)!);
      cache.delete(oldestKey);
    }
    cache.set(id, url);
    return url;
  }, []);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    const cache = blobCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  // Reload photos whenever settings change
  useEffect(() => {
    if (!dbSettings) return;
    let cancelled = false;
    const settings = dbSettings as DashboardSettings;

    setPhotoSource(settings.photoSource);
    setSlideInterval(settings.slideInterval || 1);

    async function loadRemote() {
      if (settings.photoSource === 'immich' && settings.immichUrl && settings.immichApiKey && settings.immichAlbumId) {
        const urls = await fetchImmichAlbumPhotos(settings.immichUrl, settings.immichApiKey, settings.immichAlbumId);
        if (!cancelled) setRemoteUrls(urls);
      } else if (settings.photoSource === 'google-photos' && settings.googleToken && settings.googlePhotosAlbumId) {
        const urls = await fetchGooglePhotosAlbumImages(settings.googleToken, settings.googlePhotosAlbumId);
        if (!cancelled) setRemoteUrls(urls);
      } else if (settings.photoSource === 'unsplash') {
        const key = (import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string) ?? '';
        const urls = await fetchUnsplashPhotos(key);
        if (!cancelled) setRemoteUrls(urls);
      } else {
        if (!cancelled) setRemoteUrls(DEFAULT_PHOTO_URLS);
      }
    }

    loadRemote();
    const timer = setInterval(loadRemote, 600_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [dbSettings]);

  // Build combined URL list.
  // For local photos, returns IDs (strings) — resolved to blob URLs on demand.
  // For remote photos, returns actual URLs as before.
  const getUrls = useCallback((): string[] => {
    if (photoSource === 'local' && localPhotoIds && localPhotoIds.length > 0) {
      return localPhotoIds;
    }
    if (remoteUrls.length > 0) return remoteUrls;
    return DEFAULT_PHOTO_URLS;
  }, [photoSource, localPhotoIds, remoteUrls]);

  const urls = getUrls();
  const safeIdx = urls.length > 0 ? currentIdx % urls.length : 0;
  // For local photos, use the asynchronously resolved blob URL; for remote, use directly.
  const displayUrl = photoSource === 'local' ? resolvedDisplayUrl : (urls.length > 0 ? urls[safeIdx] : null);

  // Reset index when photo list source/length changes
  useEffect(() => {
    const len = photoSource === 'local' ? (localPhotoIds?.length ?? 0) : remoteUrls.length;
    setCurrentIdx(len > 1 ? Math.floor(Math.random() * len) : 0);
    setInitialLoaded(false);
    setResolvedDisplayUrl(null);
  }, [remoteUrls.length, localPhotoIds?.length, photoSource]);

  // Preload the initial image(s)
  useEffect(() => {
    if (initialLoaded || urls.length === 0) return;
    let cancelled = false;

    if (photoSource === 'local') {
      const id = urls[safeIdx % urls.length];
      getLocalBlobUrl(id).then((blobUrl) => {
        if (!cancelled && blobUrl) {
          setResolvedDisplayUrl(blobUrl);
          setInitialLoaded(true);
        }
      });
    } else {
      const toPreload = [];
      for (let i = 0; i < Math.min(4, urls.length); i++) {
        toPreload.push(urls[(currentIdx + i) % urls.length]);
      }
      Promise.all(toPreload.map(preloadImage)).then(() => {
        if (!cancelled) setInitialLoaded(true);
      });
    }

    return () => { cancelled = true; };
  }, [initialLoaded, urls.length, currentIdx, safeIdx, photoSource, getLocalBlobUrl]);

  // Transition to a specific index
  const transitionTo = useCallback(async (targetIdx: number) => {
    if (transitioningRef.current) return;
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;

    // Cancel any pending transition timeout before starting a new one
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    transitioningRef.current = true;

    let targetUrl: string;
    if (photoSource === 'local') {
      const blobUrl = await getLocalBlobUrl(currentUrls[targetIdx]);
      if (!blobUrl) { transitioningRef.current = false; return; }
      targetUrl = blobUrl;
    } else {
      await preloadImage(currentUrls[targetIdx]);
      targetUrl = currentUrls[targetIdx];
    }

    // Show new image in the "next" layer fading IN while current fades OUT.
    // Only swap currentIdx AFTER the fade completes so both divs don't show
    // the same image (which caused the blink/flash).
    setNextUrl(targetUrl);
    setTransitioning(true);

    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentIdx(targetIdx);
      if (photoSource === 'local') setResolvedDisplayUrl(targetUrl);
      setTransitioning(false);
      setNextUrl(null);
      transitioningRef.current = false;
      transitionTimeoutRef.current = null;
    }, TRANSITION_MS);
  }, [getUrls, getLocalBlobUrl, photoSource]);

  // Cancel pending transition timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  const advancePhoto = useCallback(() => {
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;
    // Pick a random index that isn't the current one
    let nextIdx: number;
    do {
      nextIdx = Math.floor(Math.random() * currentUrls.length);
    } while (nextIdx === currentIdx && currentUrls.length > 1);
    transitionTo(nextIdx);
  }, [getUrls, currentIdx, transitionTo]);

  const previousPhoto = useCallback(() => {
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;
    transitionTo((currentIdx - 1 + currentUrls.length) % currentUrls.length);
  }, [getUrls, currentIdx, transitionTo]);

  const removeCurrentFromList = useCallback(() => {
    setRemoteUrls(prev => {
      const newUrls = [...prev];
      const idx = currentIdx % newUrls.length;
      newUrls.splice(idx, 1);
      return newUrls;
    });
    setCurrentIdx(prev => prev >= urls.length - 1 ? 0 : prev);
  }, [currentIdx, urls.length]);

  const shufflePhotos = useCallback(() => {
    setRemoteUrls(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
    setCurrentIdx(0);
  }, []);

  const getCurrentInfo = useCallback((): PhotoInfo | null => {
    if (urls.length === 0) return null;
    const url = displayUrl || urls[safeIdx];
    if (photoSource === 'local' && localPhotoIds && localPhotoIds.length > 0 && safeIdx < localPhotoIds.length) {
      return { url, source: 'local', localId: localPhotoIds[safeIdx] };
    }
    if (photoSource === 'immich') {
      return { url, source: 'immich', immichAssetId: extractImmichAssetId(url) || undefined };
    }
    return { url, source: remoteUrls.length > 0 ? photoSource : 'default' };
  }, [urls, safeIdx, displayUrl, photoSource, localPhotoIds, remoteUrls.length]);

  useImperativeHandle(ref, () => ({
    advance: advancePhoto,
    previous: previousPhoto,
    shuffle: shufflePhotos,
    getCurrentInfo,
    removeCurrentFromList,
  }), [advancePhoto, previousPhoto, shufflePhotos, getCurrentInfo, removeCurrentFromList]);

  // Slideshow timer
  const advanceRef = useRef(advancePhoto);
  advanceRef.current = advancePhoto;

  useEffect(() => {
    if (urls.length <= 1) return;
    const intervalMs = (slideInterval || 1) * 60 * 1000;
    const timer = setInterval(() => advanceRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [urls.length, slideInterval]);

  const bgSize = pictureMode ? 'contain' : 'cover';
  const bgRepeat = pictureMode ? 'no-repeat' : undefined;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: pictureMode
            ? '#000'
            : `linear-gradient(135deg, var(--theme-bg-from, #0f172a), var(--theme-bg-via, #172554), var(--theme-bg-to, #1e1b4b))`,
        }}
      />

      {displayUrl && initialLoaded && (
        <div
          className="absolute inset-0 bg-center transition-opacity"
          style={{
            backgroundImage: `url(${displayUrl})`,
            backgroundSize: bgSize,
            backgroundRepeat: bgRepeat,
            opacity: transitioning ? 0 : 1,
            transitionDuration: `${TRANSITION_MS}ms`,
          }}
        />
      )}

      {nextUrl && (
        <div
          className="absolute inset-0 bg-center transition-opacity"
          style={{
            backgroundImage: `url(${nextUrl})`,
            backgroundSize: bgSize,
            backgroundRepeat: bgRepeat,
            opacity: transitioning ? 1 : 0,
            transitionDuration: `${TRANSITION_MS}ms`,
          }}
        />
      )}

      {!pictureMode && <div className="absolute inset-0 bg-black/40" />}
    </div>
  );
});
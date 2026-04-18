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
  paused?: boolean;
}

export const PhotoSlideshow = forwardRef<PhotoSlideshowHandle, Props>(function PhotoSlideshow({ pictureMode = false, paused = false }, ref) {
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

  // Shuffle queue — ensures every photo is seen once before any repeats.
  // Works like a shuffled deck: walk through all indices in shuffled order,
  // then reshuffle and start again when the deck is exhausted.
  const shuffleQueueRef = useRef<number[]>([]);
  const queuePosRef = useRef<number>(0);

  /** Fisher-Yates shuffle of [0..n-1]. If skipFirst is provided, ensures that
   *  index is not at position 0 (avoids showing the same photo twice in a row
   *  when the queue is rebuilt). */
  const buildShuffleQueue = useCallback((n: number, skipFirst?: number) => {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // If the first entry would immediately repeat the current photo, swap it with position 1
    if (skipFirst !== undefined && n > 1 && arr[0] === skipFirst) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    shuffleQueueRef.current = arr;
    queuePosRef.current = 0;
  }, []);

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

  // Reset index and shuffle queue when the actual photo source/count changes.
  // NOTE: localPhotoIds?.length intentionally excluded from deps for Immich users
  // who also have local photos — that spurious reset would blank the screen briefly
  // every time the DB query resolves.
  useEffect(() => {
    const len = photoSource === 'local' ? (localPhotoIds?.length ?? 0) : remoteUrls.length;
    const startIdx = len > 1 ? Math.floor(Math.random() * len) : 0;
    setCurrentIdx(startIdx);
    setInitialLoaded(false);
    setResolvedDisplayUrl(null);
    // Invalidate the queue — it will be rebuilt on the next advance with the correct length
    shuffleQueueRef.current = [];
    queuePosRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUrls.length, photoSource]);

  // Preload the initial image(s).
  // For immich/google-photos, skip preloading the DEFAULT_PHOTO_URLS fallback while
  // waiting for the real album URLs so we don't flash Unsplash placeholder images.
  // For local source, also react to localPhotoIds?.length so the effect re-fires when
  // the DB query resolves — otherwise a stale closure could hold the wrong `urls`.
  useEffect(() => {
    if (initialLoaded || urls.length === 0) return;
    // Block immich/google-photos until real album URLs are loaded
    if ((photoSource === 'immich' || photoSource === 'google-photos') && remoteUrls.length === 0) return;
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
  // localPhotoIds?.length is intentionally included so the effect re-runs when the
  // Dexie query resolves — preventing a stale closure from using DEFAULT_PHOTO_URLS
  // as local photo IDs when the user has the same number of local photos as the default set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoaded, urls.length, remoteUrls.length, localPhotoIds?.length, currentIdx, safeIdx, photoSource, getLocalBlobUrl]);

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
    const n = currentUrls.length;
    // Rebuild the queue if it's empty or stale (different size than current library)
    if (shuffleQueueRef.current.length !== n || queuePosRef.current >= n) {
      buildShuffleQueue(n, currentIdx);
    }
    const nextIdx = shuffleQueueRef.current[queuePosRef.current];
    queuePosRef.current += 1;
    transitionTo(nextIdx);
  }, [getUrls, currentIdx, transitionTo, buildShuffleQueue]);

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
    const currentUrls = getUrls();
    buildShuffleQueue(currentUrls.length, currentIdx);
    // Immediately advance to the first photo in the new shuffle
    const nextIdx = shuffleQueueRef.current[0];
    queuePosRef.current = 1;
    transitionTo(nextIdx);
  }, [getUrls, currentIdx, buildShuffleQueue, transitionTo]);

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

  // Slideshow timer — paused during screen-off so the queue isn't consumed
  // while no one can see the photos.
  const advanceRef = useRef(advancePhoto);
  advanceRef.current = advancePhoto;

  useEffect(() => {
    if (urls.length <= 1 || paused) return;
    const intervalMs = (slideInterval || 1) * 60 * 1000;
    const timer = setInterval(() => advanceRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [urls.length, slideInterval, paused]);

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
          className="absolute inset-0 bg-center"
          style={{
            backgroundImage: `url(${displayUrl})`,
            backgroundSize: bgSize,
            backgroundRepeat: bgRepeat,
            opacity: transitioning ? 0 : 1,
            // Fade OUT when transitioning starts; snap back to 1 instantly when done
            // so there's no gap between nextUrl disappearing and this layer being visible.
            transition: transitioning ? `opacity ${TRANSITION_MS}ms ease-in-out` : 'none',
          }}
        />
      )}

      {nextUrl && (
        <div
          className="absolute inset-0 bg-center"
          style={{
            backgroundImage: `url(${nextUrl})`,
            backgroundSize: bgSize,
            backgroundRepeat: bgRepeat,
            opacity: transitioning ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
          }}
        />
      )}

      {!pictureMode && <div className="absolute inset-0 bg-black/40" />}
    </div>
  );
});
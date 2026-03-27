import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { fetchImmichAlbumPhotos } from '../../services/immich';
import { fetchGooglePhotosAlbumImages } from '../../services/googlePhotos';
import { fetchUnsplashPhotos, DEFAULT_PHOTO_URLS } from '../../services/unsplash';
import type { PhotoSource, DashboardSettings } from '../../types';

const TRANSITION_MS = 1500;

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
  const localPhotos = useLiveQuery(() => db.photos.orderBy('addedAt').toArray());
  const dbSettings = useLiveQuery(() => db.settings.get('main'));

  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('local');
  const [slideInterval, setSlideInterval] = useState(15);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const transitioningRef = useRef(false);

  const urlCache = useRef<Map<string, string>>(new Map());

  // Reload photos whenever settings change
  useEffect(() => {
    if (!dbSettings) return;
    let cancelled = false;
    const settings = dbSettings as DashboardSettings;

    setPhotoSource(settings.photoSource);
    setSlideInterval(settings.slideInterval || 15);

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

  const getUrl = useCallback(
    (photo: { id: string; blob: Blob }) => {
      const cached = urlCache.current.get(photo.id);
      if (cached) return cached;
      const url = URL.createObjectURL(photo.blob);
      urlCache.current.set(photo.id, url);
      return url;
    },
    [],
  );

  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  // Build combined URL list
  const getUrls = useCallback(() => {
    if (photoSource === 'local' && localPhotos && localPhotos.length > 0) {
      return localPhotos.map((p) => getUrl(p));
    }
    if (remoteUrls.length > 0) return remoteUrls;
    return DEFAULT_PHOTO_URLS;
  }, [photoSource, localPhotos, remoteUrls, getUrl]);

  const urls = getUrls();
  const safeIdx = urls.length > 0 ? currentIdx % urls.length : 0;
  const displayUrl = urls.length > 0 ? urls[safeIdx] : null;

  // Start at random index when URL list changes
  useEffect(() => {
    const len = photoSource === 'local' ? (localPhotos?.length ?? 0) : remoteUrls.length;
    setCurrentIdx(len > 1 ? Math.floor(Math.random() * len) : 0);
    setInitialLoaded(false);
  }, [remoteUrls.length, photoSource]);

  // Preload current + upcoming images to prevent flashing
  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    const toPreload = [];
    for (let i = 0; i < Math.min(4, urls.length); i++) {
      toPreload.push(urls[(currentIdx + i) % urls.length]);
    }
    Promise.all(toPreload.map(preloadImage)).then(() => {
      if (!cancelled) setInitialLoaded(true);
    });
    return () => { cancelled = true; };
  }, [currentIdx, urls]);

  // Transition to a specific index
  const transitionTo = useCallback(async (targetIdx: number) => {
    if (transitioningRef.current) return;
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;

    transitioningRef.current = true;
    await preloadImage(currentUrls[targetIdx]);

    setNextUrl(currentUrls[targetIdx]);
    setTransitioning(true);

    setTimeout(() => {
      setCurrentIdx(targetIdx);
      setTransitioning(false);
      setNextUrl(null);
      transitioningRef.current = false;
    }, TRANSITION_MS);
  }, [getUrls]);

  const advancePhoto = useCallback(() => {
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;
    transitionTo((currentIdx + 1) % currentUrls.length);
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
    const url = urls[safeIdx];
    if (photoSource === 'local' && localPhotos && localPhotos.length > 0 && safeIdx < localPhotos.length) {
      return { url, source: 'local', localId: localPhotos[safeIdx].id };
    }
    if (photoSource === 'immich') {
      return { url, source: 'immich', immichAssetId: extractImmichAssetId(url) || undefined };
    }
    return { url, source: remoteUrls.length > 0 ? photoSource : 'default' };
  }, [urls, safeIdx, photoSource, localPhotos, remoteUrls.length]);

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
    const intervalMs = (slideInterval || 15) * 1000;
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
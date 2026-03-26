import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { getSettings } from '../../services/storage';
import { fetchImmichAlbumPhotos } from '../../services/immich';
import { fetchGooglePhotosAlbumImages } from '../../services/googlePhotos';
import { fetchUnsplashPhotos, DEFAULT_PHOTO_URLS } from '../../services/unsplash';
import type { PhotoSource } from '../../types';

const SLIDE_INTERVAL = 15_000;
const TRANSITION_MS = 1500;

export function PhotoSlideshow() {
  const localPhotos = useLiveQuery(() => db.photos.orderBy('addedAt').toArray());
  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('local');

  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const urlCache = useRef<Map<string, string>>(new Map());

  // Load photo source settings and fetch remote photos
  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      const settings = await getSettings();
      if (cancelled) return;
      setPhotoSource(settings.photoSource);

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
      } else if (settings.photoSource === 'local') {
        // Use default picsum photos as fallback when no local photos exist
        if (!cancelled) setRemoteUrls(DEFAULT_PHOTO_URLS);
      }
    }

    loadPhotos();
    const interval = setInterval(loadPhotos, 600_000); // Refresh every 10min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

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
  const allUrls = useCallback(() => {
    if (photoSource === 'local' && localPhotos && localPhotos.length > 0) {
      return localPhotos.map((p) => getUrl(p));
    }
    if (remoteUrls.length > 0) return remoteUrls;
    return DEFAULT_PHOTO_URLS;
  }, [photoSource, localPhotos, remoteUrls, getUrl]);

  // Update current display
  useEffect(() => {
    const urls = allUrls();
    if (urls.length === 0) {
      setCurrentUrl(null);
      setNextUrl(null);
      return;
    }
    const safeIdx = currentIdx % urls.length;
    setCurrentUrl(urls[safeIdx]);
  }, [allUrls, currentIdx]);

  // Slideshow timer
  useEffect(() => {
    const urls = allUrls();
    if (urls.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIdx((prev) => {
        const nextIdx = (prev + 1) % urls.length;
        setNextUrl(urls[nextIdx]);
        setTransitioning(true);

        setTimeout(() => {
          setCurrentIdx(nextIdx);
          setTransitioning(false);
          setNextUrl(null);
        }, TRANSITION_MS);

        return prev;
      });
    }, SLIDE_INTERVAL);

    return () => clearInterval(timer);
  }, [allUrls]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, var(--theme-bg-from, #0f172a), var(--theme-bg-via, #172554), var(--theme-bg-to, #1e1b4b))`,
        }}
      />

      {currentUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity"
          style={{
            backgroundImage: `url(${currentUrl})`,
            opacity: transitioning ? 0 : 1,
            transitionDuration: `${TRANSITION_MS}ms`,
          }}
        />
      )}

      {nextUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity"
          style={{
            backgroundImage: `url(${nextUrl})`,
            opacity: transitioning ? 1 : 0,
            transitionDuration: `${TRANSITION_MS}ms`,
          }}
        />
      )}

      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}

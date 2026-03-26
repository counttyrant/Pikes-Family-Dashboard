import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { fetchImmichAlbumPhotos } from '../../services/immich';
import { fetchGooglePhotosAlbumImages } from '../../services/googlePhotos';
import { fetchUnsplashPhotos, DEFAULT_PHOTO_URLS } from '../../services/unsplash';
import type { PhotoSource, DashboardSettings } from '../../types';
import { SkipForward } from 'lucide-react';

const TRANSITION_MS = 1500;

export function PhotoSlideshow() {
  const localPhotos = useLiveQuery(() => db.photos.orderBy('addedAt').toArray());
  const dbSettings = useLiveQuery(() => db.settings.get('main'));

  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('local');
  const [slideInterval, setSlideInterval] = useState(15);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(false);

  const urlCache = useRef<Map<string, string>>(new Map());

  // Reload photos whenever settings change (reactive via useLiveQuery)
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
        // local or fallback — use curated defaults when no local photos uploaded
        if (!cancelled) setRemoteUrls(DEFAULT_PHOTO_URLS);
      }
    }

    loadRemote();
    // Refresh remote URLs periodically
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

  // Reset index when URL list changes
  useEffect(() => {
    setCurrentIdx(0);
  }, [remoteUrls.length, photoSource]);

  // Advance to next photo
  const advancePhoto = useCallback(() => {
    if (transitioningRef.current) return;
    const currentUrls = getUrls();
    if (currentUrls.length <= 1) return;

    const nextIdx = (currentIdx + 1) % currentUrls.length;
    setNextUrl(currentUrls[nextIdx]);
    setTransitioning(true);
    transitioningRef.current = true;

    setTimeout(() => {
      setCurrentIdx(nextIdx);
      setTransitioning(false);
      setNextUrl(null);
      transitioningRef.current = false;
    }, TRANSITION_MS);
  }, [getUrls, currentIdx]);

  // Slideshow timer
  const advanceRef = useRef(advancePhoto);
  advanceRef.current = advancePhoto;

  useEffect(() => {
    if (urls.length <= 1) return;
    const intervalMs = (slideInterval || 15) * 1000;
    const timer = setInterval(() => advanceRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [urls.length, slideInterval]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, var(--theme-bg-from, #0f172a), var(--theme-bg-via, #172554), var(--theme-bg-to, #1e1b4b))`,
        }}
      />

      {displayUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity"
          style={{
            backgroundImage: `url(${displayUrl})`,
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

      {/* Skip photo button */}
      {urls.length > 1 && (
        <button
          onClick={() => advancePhoto()}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-30 p-3 rounded-full bg-black/30 backdrop-blur-sm text-white/50 hover:text-white hover:bg-black/50 transition-all active:scale-95"
          title="Next photo"
        >
          <SkipForward size={18} />
        </button>
      )}
    </div>
  );
}

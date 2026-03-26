import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';

const SLIDE_INTERVAL = 15_000;
const TRANSITION_MS = 1500;

export function PhotoSlideshow() {
  const photos = useLiveQuery(() => db.photos.orderBy('addedAt').toArray());

  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Track URLs we've created so we can revoke them
  const urlCache = useRef<Map<string, string>>(new Map());

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

  // Revoke all blob URLs on unmount
  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  // Rebuild URLs when photos array changes
  useEffect(() => {
    if (!photos || photos.length === 0) {
      setCurrentUrl(null);
      setNextUrl(null);
      return;
    }

    // Revoke stale URLs for photos that no longer exist
    const photoIds = new Set(photos.map((p) => p.id));
    urlCache.current.forEach((url, id) => {
      if (!photoIds.has(id)) {
        URL.revokeObjectURL(url);
        urlCache.current.delete(id);
      }
    });

    const safeIdx = currentIdx % photos.length;
    setCurrentUrl(getUrl(photos[safeIdx]));
  }, [photos, currentIdx, getUrl]);

  // Slideshow timer
  useEffect(() => {
    if (!photos || photos.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIdx((prev) => {
        const nextIdx = (prev + 1) % photos.length;
        setNextUrl(getUrl(photos[nextIdx]));
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
  }, [photos, getUrl]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Fallback gradient when no photos */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />

      {/* Current photo */}
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

      {/* Next photo (crossfade in) */}
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

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}

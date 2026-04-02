import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Navigation } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import Dashboard from './pages/Dashboard'
import ChoreChart from './pages/ChoreChart'
import ShoppingNotes from './pages/ShoppingNotes'
import ActivitiesPage from './pages/ActivitiesPage'
import RecipesPage from './pages/RecipesPage'
import JellyfinPage from './pages/JellyfinPage'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { AiAssistant } from './components/ai/AiAssistant'
import { PhotoSlideshow } from './components/widgets/PhotoSlideshow'
import type { PhotoSlideshowHandle } from './components/widgets/PhotoSlideshow'
import { LoginScreen } from './components/auth/LoginScreen'
import { ReconnectBanner } from './components/auth/ReconnectBanner'
import { BouncingClock } from './components/BouncingClock'
import { PresenceMonitor } from './components/presence/CameraPresenceMonitor'
import { DimOverlay } from './components/presence/DimOverlay'
import { useAuth } from './contexts/AuthContext'
import { db } from './db'
import { getSettings } from './services/storage'
import { initCloudSync } from './services/cloudSync'
import { removeFromImmichAlbum, toggleImmichFavorite } from './services/immich'
import { setBrightness } from './services/brightnessService'
import type { DashboardSettings } from './types'
import { Maximize, Minimize, Settings, ChevronLeft, ChevronRight, ImagePlay, X, Home, Trash2, Shuffle, Heart } from 'lucide-react'
import { ALL_PAGES, DEFAULT_PAGE_ORDER } from './constants/pages'

// Re-export for any other consumers
export { ALL_PAGES, DEFAULT_PAGE_ORDER } from './constants/pages'


function AppContent() {
  const { user, sessionExpired, accessToken } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [isDimmed, setIsDimmed] = useState(false)
  const [pictureMode, setPictureMode] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const swiperRef = useRef<SwiperType | null>(null)
  const slideshowRef = useRef<PhotoSlideshowHandle | null>(null)
  const touchStartX = useRef(0)

  // Auto-hide controls after inactivity
  const [showControls, setShowControls] = useState(true)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 120_000)
  }, [])

  useEffect(() => {
    const handleInteraction = () => resetControlsTimer()
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown']
    events.forEach(e => window.addEventListener(e, handleInteraction))
    resetControlsTimer()
    return () => {
      clearTimeout(controlsTimer.current)
      events.forEach(e => window.removeEventListener(e, handleInteraction))
    }
  }, [resetControlsTimer])

  const dbSettings = useLiveQuery(() => db.settings.get('main'))

  // Pull settings from cloud on first load
  useEffect(() => {
    initCloudSync().then((ok) => {
      if (ok) console.log('Cloud sync initialized — settings pulled from cloud');
    });
  }, [])

  useEffect(() => {
    getSettings().then(setSettings)
  }, [dbSettings])

  // Night mode + late night mode
  const [isNightMode, setIsNightMode] = useState(false)
  const [isLateNight, setIsLateNight] = useState(false)
  useEffect(() => {
    if (!settings) return
    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      // Regular night mode (dim)
      const start = settings.nightModeStart
      const end = settings.nightModeEnd
      if (start <= end) {
        setIsNightMode(hhmm >= start && hhmm < end)
      } else {
        setIsNightMode(hhmm >= start || hhmm < end)
      }

      // Late night mode (bouncing clock screensaver)
      if (settings.lateNightEnabled) {
        const lnStart = settings.lateNightStart || '22:00'
        const lnEnd = settings.lateNightEnd || '06:00'
        if (lnStart <= lnEnd) {
          setIsLateNight(hhmm >= lnStart && hhmm < lnEnd)
        } else {
          setIsLateNight(hhmm >= lnStart || hhmm < lnEnd)
        }
      } else {
        setIsLateNight(false)
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [settings])

  // Screen saver / idle detection
  const screenSaverTimeout = settings?.screenSaverTimeout || 300;
  useEffect(() => {
    const timeout = screenSaverTimeout * 1000
    let timer: ReturnType<typeof setTimeout>

    const reset = () => {
      setIsIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIsIdle(true), timeout)
    }

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll']
    events.forEach(e => window.addEventListener(e, reset))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [screenSaverTimeout])

  // Auto picture mode on idle
  const autoPictureMode = settings?.autoPictureMode ?? true;
  const autoPictureModeTimeout = settings?.autoPictureModeTimeout ?? 300;
  useEffect(() => {
    if (!autoPictureMode) return;
    const timeout = autoPictureModeTimeout * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPictureMode(true), timeout);
    };

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [autoPictureMode, autoPictureModeTimeout])

  // Fullscreen handler
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const nightClass = isNightMode ? 'brightness-50' : ''

  // Build the ordered list of enabled pages (must be before any early return)
  const enabledPages = useMemo(() => {
    const order = settings?.enabledPages ?? DEFAULT_PAGE_ORDER;
    return order.filter(id => ALL_PAGES.some(p => p.id === id));
  }, [settings?.enabledPages]);

  const pageLabels = useMemo(
    () => enabledPages.map(id => ALL_PAGES.find(p => p.id === id)?.label ?? id),
    [enabledPages]
  );

  // Delete current photo (local or Immich)
  const handleDeletePhoto = useCallback(async () => {
    const info = slideshowRef.current?.getCurrentInfo();
    if (!info) return;
    if (info.source === 'local' && info.localId) {
      await db.photos.delete(info.localId);
    } else if (info.source === 'immich' && info.immichAssetId && settings) {
      try {
        await removeFromImmichAlbum(settings.immichUrl, settings.immichApiKey, settings.immichAlbumId, info.immichAssetId);
        slideshowRef.current?.removeCurrentFromList();
      } catch (err) {
        console.error('Failed to remove from Immich album:', err);
      }
    }
  }, [settings]);

  // Favorite current photo in Immich
  const [isFavorited, setIsFavorited] = useState(false)
  const handleFavoritePhoto = useCallback(async () => {
    const info = slideshowRef.current?.getCurrentInfo();
    if (!info || info.source !== 'immich' || !info.immichAssetId || !settings) return;
    const newVal = !isFavorited;
    try {
      await toggleImmichFavorite(settings.immichUrl, settings.immichApiKey, info.immichAssetId, newVal);
      setIsFavorited(newVal);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }, [settings, isFavorited]);

  // Show login screen only when there is no user at all (never signed in)
  if (!user) {
    return <LoginScreen />
  }

  // Render a page component by its id
  const renderPage = (id: string) => {
    switch (id) {
      case 'dashboard':
        return <Dashboard settings={settings} accessToken={accessToken} />;
      case 'chores':
        return <ChoreChart />;
      case 'shopping':
        return <ShoppingNotes />;
      case 'activities':
        return <ActivitiesPage />;
      case 'recipes':
        return (
          <RecipesPage
            apiKey={settings?.openaiApiKey || ''}
            aiProvider={settings?.aiProvider || 'openai'}
            azureEndpoint={settings?.azureEndpoint || ''}
            azureDeployment={settings?.azureDeployment || ''}
            openaiModel={settings?.openaiModel || 'gpt-4o-mini'}
          />
        );
      case 'jellyfin':
        return <JellyfinPage />;
      default:
        return null;
    }
  };

  return (
    <div className={`h-screen w-screen overflow-hidden text-white ${nightClass} transition-all duration-500`}>
      {/* Presence monitor — invisible, keeps screen awake on motion */}
      {settings && (
        <PresenceMonitor settings={{
          presenceDetectionEnabled: settings.presenceDetectionEnabled ?? false,
          presenceSensitivity: settings.presenceSensitivity ?? 5,
          presenceInactivityTimeout: settings.presenceInactivityTimeout ?? 5,
          presenceScheduleEnabled: settings.presenceScheduleEnabled ?? false,
          presenceScheduleStart: settings.presenceScheduleStart ?? '07:00',
          presenceScheduleEnd: settings.presenceScheduleEnd ?? '22:00',
          presenceSource: settings.presenceSource ?? 'camera',
        }}
        onDim={() => {
          if (settings.dimEnabled) setIsDimmed(true);
          if (settings.brightnessServiceEnabled) {
            setBrightness(settings.brightnessOnIdle ?? 10, settings.brightnessServicePort ?? 3737);
          }
        }}
        onUndim={() => {
          setIsDimmed(false);
          if (settings.brightnessServiceEnabled) {
            setBrightness(settings.brightnessOnPresence ?? 100, settings.brightnessServicePort ?? 3737);
          }
        }}
        />
      )}

      {/* Dim overlay — shown when idle, tap to dismiss */}
      {isDimmed && settings && (
        <DimOverlay
          mode={settings.dimMode ?? 'partial'}
          opacity={settings.dimOpacity ?? 70}
          onDismiss={() => {
            setIsDimmed(false);
            if (settings.brightnessServiceEnabled) {
              setBrightness(settings.brightnessOnPresence ?? 100, settings.brightnessServicePort ?? 3737);
            }
          }}
        />
      )}

      {/* Screen saver overlay */}
      {isIdle && !pictureMode && (
        <div
          className="fixed inset-0 z-50 bg-black cursor-pointer"
          onClick={() => setIsIdle(false)}
          onTouchStart={() => setIsIdle(false)}
        />
      )}

      <PhotoSlideshow ref={slideshowRef} pictureMode={pictureMode} />

      {/* Late night mode — full-screen bouncing clock screensaver, prevents burn-in */}
      {isLateNight && <BouncingClock />}

      {/* Non-blocking reconnect banner — floats over dashboard when session expires */}
      {sessionExpired && <ReconnectBanner />}

      {/* Picture mode — swipeable photos with clock, fit to screen */}
      {pictureMode && (
        <div
          className="fixed inset-0 z-50"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 50) {
              if (dx > 0) slideshowRef.current?.previous();
              else slideshowRef.current?.advance();
            }
          }}
        >
          {/* Clock overlay */}
          <PictureModeClock />

          {/* Next event overlay */}
          <PictureModeNextEvent accessToken={accessToken ?? undefined} settings={settings} />

          {/* Controls — visible when showControls is true */}
          <div className={`absolute top-4 right-4 z-50 flex gap-2 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); slideshowRef.current?.previous(); }}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); slideshowRef.current?.advance(); }}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Next photo"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); slideshowRef.current?.shuffle(); }}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-purple-500/60 transition-colors"
              title="Shuffle photos"
            >
              <Shuffle size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleFavoritePhoto(); }}
              className={`rounded-full p-3 backdrop-blur-sm transition-colors ${isFavorited ? 'bg-pink-500/60 hover:bg-pink-500/80' : 'bg-black/40 hover:bg-pink-500/40'}`}
              title={isFavorited ? 'Unfavorite' : 'Add to favorites'}
            >
              <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(); }}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-red-500/60 transition-colors"
              title="Remove from album"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setPictureMode(false); }}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Exit picture mode"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Everything below is hidden in picture mode */}
      {!pictureMode && (
        <>
          {/* Top bar controls */}
          <div className={`fixed top-4 right-4 z-40 flex gap-2 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={() => setPictureMode(true)}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Picture mode"
            >
              <ImagePlay size={20} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>

          {/* Main swiper — driven by enabledPages */}
          <Swiper
            key={enabledPages.join(',')}
            modules={[Pagination, Navigation]}
            pagination={{ clickable: true }}
            spaceBetween={0}
            slidesPerView={1}
            loop={enabledPages.length > 1}
            className="h-full w-full"
            touchRatio={1.5}
            resistance={true}
            resistanceRatio={0.85}
            noSwipingSelector=".no-swipe"
            onSwiper={(sw) => { swiperRef.current = sw }}
            onSlideChange={(sw) => setActiveIndex(sw.realIndex)}
          >
            {enabledPages.map((id) => (
              <SwiperSlide key={id}>{renderPage(id)}</SwiperSlide>
            ))}
          </Swiper>

          {/* Bottom navigation bar */}
          <div className={`fixed bottom-4 left-4 z-40 flex items-center gap-2 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={() => {
                const sw = swiperRef.current;
                if (sw) sw.params.loop ? sw.slideToLoop(0) : sw.slideTo(0);
              }}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Home"
            >
              <Home size={18} />
            </button>
            <button
              onClick={() => swiperRef.current?.slidePrev()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium w-24 text-center truncate">
              {pageLabels[activeIndex] || ''}
            </div>
            <button
              onClick={() => swiperRef.current?.slideNext()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => slideshowRef.current?.shuffle()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-purple-500/60 transition-colors"
              title="Shuffle photos"
            >
              <Shuffle size={18} />
            </button>
          </div>

          {/* Settings panel */}
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

          {/* AI Assistant */}
          <div className={`transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <AiAssistant
              apiKey={settings?.openaiApiKey || ''}
              aiProvider={settings?.aiProvider || 'openai'}
              azureEndpoint={settings?.azureEndpoint || ''}
              azureDeployment={settings?.azureDeployment || ''}
              openaiModel={settings?.openaiModel || 'gpt-4o-mini'}
              ttsEngine={settings?.ttsEngine || 'openai'}
              ttsVoiceName={settings?.ttsVoiceName || ''}
              ttsRate={settings?.ttsRate ?? 0.95}
              ttsPitch={settings?.ttsPitch ?? 1.1}
              openaiTtsApiKey={settings?.openaiTtsApiKey || ''}
              openaiTtsVoice={settings?.openaiTtsVoice || 'nova'}
              openaiTtsModel={settings?.openaiTtsModel || 'tts-1'}
            />
          </div>
        </>
      )}
    </div>
  )
}

function PictureModeClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute bottom-8 left-8 z-50 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
      <div className="text-6xl font-light tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-xl text-white/80">
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

function PictureModeNextEvent({ accessToken, settings }: { accessToken?: string; settings: DashboardSettings | null }) {
  const [nextEvent, setNextEvent] = useState<{ title: string; time: string; emoji?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const findNext = async () => {
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const candidates: { title: string; start: Date; emoji?: string }[] = [];

      // 1. Google Calendar events
      if (accessToken && settings?.selectedCalendarIds?.length) {
        try {
          const { fetchCalendarEvents } = await import('./services/googleCalendar');
          for (const calId of settings.selectedCalendarIds) {
            const events = await fetchCalendarEvents(accessToken, now, todayEnd, calId);
            for (const e of events) {
              const start = new Date(e.start);
              if (start >= now) candidates.push({ title: e.title, start });
            }
          }
        } catch { /* ignore calendar errors */ }
      }

      // 2. Local calendar events
      try {
        const localEvts = await db.localEvents.where('start').aboveOrEqual(now).toArray();
        for (const e of localEvts) {
          const start = new Date(e.start);
          if (start >= now && start <= todayEnd) {
            candidates.push({ title: e.title, start });
          }
        }
      } catch { /* ignore */ }

      // 3. Activities (from localStorage)
      try {
        const raw = localStorage.getItem('pfd-activities');
        if (raw) {
          const activities: { label: string; time?: string; done: boolean; emoji?: string }[] = JSON.parse(raw);
          for (const a of activities) {
            if (a.done || !a.time) continue;
            const [h, m] = a.time.split(':').map(Number);
            const aDate = new Date(now);
            aDate.setHours(h, m, 0, 0);
            if (aDate >= now && aDate <= todayEnd) {
              candidates.push({ title: a.label, start: aDate, emoji: a.emoji });
            }
          }
        }
      } catch { /* ignore */ }

      // Sort and pick earliest
      candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
      const next = candidates[0];
      if (!cancelled && next) {
        setNextEvent({
          title: next.title,
          time: next.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emoji: next.emoji,
        });
      } else if (!cancelled) {
        setNextEvent(null);
      }
    };

    findNext();
    const interval = setInterval(findNext, 60_000); // refresh every minute
    return () => { cancelled = true; clearInterval(interval); };
  }, [accessToken, settings?.selectedCalendarIds]);

  if (!nextEvent) return null;

  return (
    <div className="absolute bottom-8 right-8 z-50 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
      <div className="text-sm text-white/60 uppercase tracking-wider mb-1">Up Next</div>
      <div className="text-2xl font-light">
        {nextEvent.emoji && <span className="mr-2">{nextEvent.emoji}</span>}
        {nextEvent.title}
      </div>
      <div className="text-lg text-white/70">{nextEvent.time}</div>
    </div>
  );
}

function App() {
  return <AppContent />
}

export default App

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
import { useAuth } from './contexts/AuthContext'
import { db } from './db'
import { getSettings } from './services/storage'
import { initCloudSync } from './services/cloudSync'
import { removeFromImmichAlbum } from './services/immich'
import type { DashboardSettings } from './types'
import { Maximize, Minimize, Settings, ChevronLeft, ChevronRight, ImagePlay, X, Home, Trash2, SkipForward } from 'lucide-react'
import { ALL_PAGES, DEFAULT_PAGE_ORDER } from './constants/pages'

// Re-export for any other consumers
export { ALL_PAGES, DEFAULT_PAGE_ORDER } from './constants/pages'


function AppContent() {
  const { user } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [pictureMode, setPictureMode] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const swiperRef = useRef<SwiperType | null>(null)
  const slideshowRef = useRef<PhotoSlideshowHandle | null>(null)
  const touchStartX = useRef(0)

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

  // Night mode
  const [isNightMode, setIsNightMode] = useState(false)
  useEffect(() => {
    if (!settings) return
    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const start = settings.nightModeStart
      const end = settings.nightModeEnd
      if (start <= end) {
        setIsNightMode(hhmm >= start && hhmm < end)
      } else {
        setIsNightMode(hhmm >= start || hhmm < end)
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

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />
  }

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

  // Render a page component by its id
  const renderPage = (id: string) => {
    switch (id) {
      case 'dashboard':
        return <Dashboard settings={settings} accessToken={user!.accessToken} />;
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
      {/* Screen saver overlay */}
      {isIdle && !pictureMode && (
        <div
          className="fixed inset-0 z-50 bg-black cursor-pointer"
          onClick={() => setIsIdle(false)}
          onTouchStart={() => setIsIdle(false)}
        />
      )}

      <PhotoSlideshow ref={slideshowRef} pictureMode={pictureMode} />

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

          {/* Controls — visible on hover/tap */}
          <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{ opacity: undefined }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.3'; }}
          >
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
          <div className="fixed top-4 right-4 z-40 flex gap-2">
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
            onSwiper={(sw) => { swiperRef.current = sw }}
            onSlideChange={(sw) => setActiveIndex(sw.realIndex)}
          >
            {enabledPages.map((id) => (
              <SwiperSlide key={id}>{renderPage(id)}</SwiperSlide>
            ))}
          </Swiper>

          {/* Bottom navigation bar */}
          <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
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
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium">
              {pageLabels[activeIndex] || ''}
            </div>
            <button
              onClick={() => swiperRef.current?.slideNext()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => slideshowRef.current?.advance()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm hover:bg-black/60 transition-colors"
              title="Next photo"
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Settings panel */}
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

          {/* AI Assistant */}
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

function App() {
  return <AppContent />
}

export default App

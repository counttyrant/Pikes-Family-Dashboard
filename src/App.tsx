import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import Dashboard from './pages/Dashboard'
import ChoreChart from './pages/ChoreChart'
import ShoppingNotes from './pages/ShoppingNotes'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { AiAssistant } from './components/ai/AiAssistant'
import { PhotoSlideshow } from './components/widgets/PhotoSlideshow'
import { LoginScreen } from './components/auth/LoginScreen'
import { useAuth } from './contexts/AuthContext'
import { db } from './db'
import { getSettings } from './services/storage'
import { initCloudSync } from './services/cloudSync'
import type { DashboardSettings } from './types'
import { Maximize, Minimize, Settings } from 'lucide-react'

function AppContent() {
  const { user } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings | null>(null)

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
  useEffect(() => {
    if (!settings) return
    const timeout = (settings.screenSaverTimeout || 300) * 1000
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
  }, [settings])

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

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />
  }

  const nightClass = isNightMode ? 'brightness-50' : ''

  return (
    <div className={`h-screen w-screen overflow-hidden text-white ${nightClass} transition-all duration-500`}>
      {/* Screen saver overlay */}
      {isIdle && (
        <div
          className="fixed inset-0 z-50 bg-black cursor-pointer"
          onClick={() => setIsIdle(false)}
          onTouchStart={() => setIsIdle(false)}
        />
      )}

      <PhotoSlideshow />

      {/* Top bar controls */}
      <div className="fixed top-4 right-4 z-40 flex gap-2">
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

      {/* Main swiper */}
      <Swiper
        modules={[Pagination]}
        pagination={{ clickable: true }}
        spaceBetween={0}
        slidesPerView={1}
        className="h-full w-full"
        touchRatio={1.5}
        resistance={true}
        resistanceRatio={0.85}
      >
        <SwiperSlide>
          <Dashboard settings={settings} accessToken={user.accessToken} />
        </SwiperSlide>
        <SwiperSlide>
          <ChoreChart />
        </SwiperSlide>
        <SwiperSlide>
          <ShoppingNotes />
        </SwiperSlide>
      </Swiper>

      {/* Settings panel */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* AI Assistant */}
      <AiAssistant
        apiKey={settings?.openaiApiKey || ''}
        aiProvider={settings?.aiProvider || 'openai'}
        azureEndpoint={settings?.azureEndpoint || ''}
        azureDeployment={settings?.azureDeployment || ''}
        openaiModel={settings?.openaiModel || 'gpt-4o-mini'}
      />
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App

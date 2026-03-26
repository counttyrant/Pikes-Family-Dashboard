import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { GridLayout, verticalCompactor } from 'react-grid-layout'
import { Clock } from '../components/widgets/Clock'
import { Weather } from '../components/widgets/Weather'
import { Calendar } from '../components/widgets/Calendar'
import { Countdown } from '../components/widgets/Countdown'
import { Chores } from '../components/widgets/Chores'
import { TodoList } from '../components/widgets/TodoList'
import { Notes } from '../components/widgets/Notes'
import { DailyQuote } from '../components/widgets/DailyQuote'
import { WidgetContainer } from '../components/widgets/WidgetContainer'
import { WIDGET_REGISTRY, getWidgetDef } from '../components/widgets/widgetRegistry'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import { db } from '../db'
import { saveSettings } from '../services/storage'
import type { DashboardSettings, WidgetLayout } from '../types'
import { Lock, Unlock, Plus, X, LayoutGrid } from 'lucide-react'

const DEFAULT_LAYOUTS: WidgetLayout[] = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 3 },
  { i: 'weather', x: 4, y: 0, w: 4, h: 3 },
  { i: 'countdown', x: 8, y: 0, w: 4, h: 3 },
  { i: 'calendar', x: 0, y: 3, w: 12, h: 5 },
]

const DEFAULT_ACTIVE = ['clock', 'weather', 'countdown', 'calendar']

interface DashboardProps {
  settings: DashboardSettings | null
  accessToken?: string | null
}

export default function Dashboard({ settings, accessToken }: DashboardProps) {
  const [editMode, setEditMode] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const countdownEvents = useLiveQuery(() => db.countdownEvents.orderBy('date').toArray()) ?? []

  const calendarIds = useMemo(
    () => (settings?.selectedCalendarIds?.length ? settings.selectedCalendarIds : ['primary']),
    [settings?.selectedCalendarIds],
  )
  const { events: calendarEvents } = useGoogleCalendar(accessToken ?? null, calendarIds)

  const activeWidgets = settings?.activeWidgets?.length ? settings.activeWidgets : DEFAULT_ACTIVE
  const allLayouts = settings?.layouts?.length ? settings.layouts : DEFAULT_LAYOUTS
  const calendarColors: Record<string, string> = settings?.calendarColors ?? {}
  const widgetColors: Record<string, string> = settings?.widgetColors ?? {}
  const eventColorOverrides: Record<string, string> = settings?.eventColorOverrides ?? {}

  const handleWidgetColorChange = useCallback((widgetId: string, color: string) => {
    const updated = { ...widgetColors, [widgetId]: color }
    if (!color) delete updated[widgetId]
    saveSettings({ widgetColors: updated })
  }, [widgetColors])

  const handleEventColorChange = useCallback((eventId: string, color: string) => {
    const updated = { ...eventColorOverrides, [eventId]: color }
    saveSettings({ eventColorOverrides: updated })
  }, [eventColorOverrides])

  // Only include layouts for active widgets
  const layouts = useMemo(() => {
    return activeWidgets.map((id) => {
      const existing = allLayouts.find((l) => l.i === id)
      if (existing) return existing
      const def = getWidgetDef(id)
      const maxY = allLayouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)
      return {
        i: id,
        x: 0,
        y: maxY,
        w: def?.defaultLayout.w ?? 4,
        h: def?.defaultLayout.h ?? 3,
      }
    })
  }, [activeWidgets, allLayouts])

  const handleLayoutChange = useCallback(
    (newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
      if (editMode) {
        saveSettings({
          layouts: newLayout.map((l) => ({
            i: l.i, x: l.x, y: l.y, w: l.w, h: l.h,
          })),
        })
      }
    },
    [editMode],
  )

  const addWidget = (id: string) => {
    if (activeWidgets.includes(id)) return
    const updated = [...activeWidgets, id]
    saveSettings({ activeWidgets: updated })
  }

  const removeWidget = (id: string) => {
    const updated = activeWidgets.filter((w) => w !== id)
    if (updated.length === 0) return // don't allow removing all
    saveSettings({ activeWidgets: updated })
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'clock':
        return <Clock />
      case 'weather':
        return (
          <Weather
            apiKey={settings?.weatherApiKey ?? ''}
            location={settings?.weatherLocation ?? ''}
          />
        )
      case 'countdown':
        return <Countdown events={countdownEvents} />
      case 'calendar':
        return <Calendar events={calendarEvents} accessToken={accessToken} calendarColors={calendarColors} eventColorOverrides={eventColorOverrides} onEventColorChange={handleEventColorChange} />
      case 'chores':
        return <Chores />
      case 'todos':
        return <TodoList />
      case 'notes':
        return <Notes />
      case 'quote':
        return <DailyQuote />
      default:
        return <div className="text-white/40 text-sm">Unknown widget</div>
    }
  }

  const getWidgetTitle = (id: string) => {
    const def = getWidgetDef(id)
    if (id === 'clock') return ''
    return def?.label ?? id
  }

  if (containerWidth === 0) {
    return <div ref={containerRef} className="h-full w-full p-4 pt-16 relative" />
  }

  const inactiveWidgets = WIDGET_REGISTRY.filter((w) => !activeWidgets.includes(w.id))

  return (
    <div
      ref={containerRef}
      className={`h-full w-full p-4 pt-16 relative ${editMode ? 'swiper-no-swiping' : ''}`}
    >
      {/* Edit mode controls */}
      <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`rounded-full p-3 backdrop-blur-sm transition-colors ${
            editMode ? 'bg-blue-500/60 text-white' : 'bg-black/40 text-white'
          }`}
          title={editMode ? 'Lock layout' : 'Unlock layout to rearrange'}
        >
          {editMode ? <Unlock size={20} /> : <Lock size={20} />}
        </button>

        {editMode && (
          <>
            <div className="bg-blue-500/60 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm">
              Drag headers to move · Drag corners to resize
            </div>
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className={`rounded-full p-3 backdrop-blur-sm transition-colors ${
                showLibrary ? 'bg-green-500/60 text-white' : 'bg-black/40 text-white'
              }`}
              title="Add or remove widgets"
            >
              <LayoutGrid size={20} />
            </button>
          </>
        )}
      </div>

      {/* Widget Library Panel */}
      {editMode && showLibrary && (
        <div className="fixed top-16 left-4 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border backdrop-blur-xl shadow-2xl p-4"
          style={{
            backgroundColor: 'var(--theme-card, rgba(30, 41, 59, 0.95))',
            borderColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white/80">Widget Library</h3>
            <button onClick={() => setShowLibrary(false)} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={16} className="text-white/50" />
            </button>
          </div>

          {/* Active widgets */}
          <div className="mb-4">
            <span className="text-[0.6rem] uppercase tracking-wider text-white/40 font-semibold">Active</span>
            <div className="flex flex-col gap-1 mt-1">
              {activeWidgets.map((id) => {
                const def = getWidgetDef(id)
                if (!def) return null
                const Icon = def.icon
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <Icon size={16} className="text-white/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80">{def.label}</p>
                    </div>
                    <button
                      onClick={() => removeWidget(id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      title="Remove widget"
                    >
                      <X size={14} className="text-red-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Available to add */}
          {inactiveWidgets.length > 0 && (
            <div>
              <span className="text-[0.6rem] uppercase tracking-wider text-white/40 font-semibold">Available</span>
              <div className="flex flex-col gap-1 mt-1">
                {inactiveWidgets.map((def) => {
                  const Icon = def.icon
                  return (
                    <button
                      key={def.id}
                      onClick={() => addWidget(def.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left w-full"
                    >
                      <Icon size={16} className="text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/60">{def.label}</p>
                        <p className="text-[0.6rem] text-white/30">{def.description}</p>
                      </div>
                      <Plus size={16} className="text-green-400 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <GridLayout
        width={containerWidth}
        layout={layouts.map((l) => {
          const def = getWidgetDef(l.i)
          return { ...l, minW: def?.minW ?? 2, minH: def?.minH ?? 2 }
        })}
        gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16] }}
        dragConfig={{ enabled: editMode, handle: '.drag-handle' }}
        resizeConfig={{ enabled: editMode, handles: ['se', 'sw', 'ne', 'nw'] }}
        compactor={verticalCompactor}
        autoSize={true}
        onLayoutChange={(layout) => handleLayoutChange(layout)}
      >
        {activeWidgets.map((id) => (
          <div key={id}>
            <WidgetContainer
              title={getWidgetTitle(id)}
              className="h-full"
              editMode={editMode}
              widgetColor={widgetColors[id]}
              onColorChange={(color) => handleWidgetColorChange(id, color)}
            >
              {renderWidget(id)}
            </WidgetContainer>
          </div>
        ))}
      </GridLayout>
    </div>
  )
}

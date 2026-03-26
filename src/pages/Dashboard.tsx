import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { GridLayout, verticalCompactor } from 'react-grid-layout'
import { Clock } from '../components/widgets/Clock'
import { Weather } from '../components/widgets/Weather'
import { Calendar } from '../components/widgets/Calendar'
import { Countdown } from '../components/widgets/Countdown'
import { WidgetContainer } from '../components/widgets/WidgetContainer'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import { db } from '../db'
import { saveSettings } from '../services/storage'
import type { DashboardSettings, WidgetLayout } from '../types'
import { Lock, Unlock } from 'lucide-react'

const DEFAULT_LAYOUTS: WidgetLayout[] = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 3 },
  { i: 'weather', x: 4, y: 0, w: 4, h: 3 },
  { i: 'countdown', x: 8, y: 0, w: 4, h: 3 },
  { i: 'calendar', x: 0, y: 3, w: 12, h: 5 },
]

interface DashboardProps {
  settings: DashboardSettings | null
  accessToken?: string | null
}

export default function Dashboard({ settings, accessToken }: DashboardProps) {
  const [editMode, setEditMode] = useState(false)

  const countdownEvents = useLiveQuery(() => db.countdownEvents.orderBy('date').toArray()) ?? []
  const { events: calendarEvents } = useGoogleCalendar(settings?.googleToken ?? null)

  const layouts = settings?.layouts?.length ? settings.layouts : DEFAULT_LAYOUTS

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

  return (
    <div className="h-full w-full p-4 pt-16 relative">
      <button
        onClick={() => setEditMode(!editMode)}
        className={`fixed top-4 left-4 z-40 rounded-full p-3 backdrop-blur-sm transition-colors ${
          editMode ? 'bg-blue-500/60 text-white' : 'bg-black/40 text-white'
        }`}
        title={editMode ? 'Lock layout' : 'Unlock layout to rearrange'}
      >
        {editMode ? <Unlock size={20} /> : <Lock size={20} />}
      </button>

      <GridLayout
        width={1200}
        layout={layouts.map((l) => ({ ...l, minW: 2, minH: 2 }))}
        gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16] }}
        dragConfig={{ enabled: editMode, handle: '.drag-handle' }}
        resizeConfig={{ enabled: editMode }}
        compactor={verticalCompactor}
        autoSize={true}
        onLayoutChange={(layout) => handleLayoutChange(layout)}
      >
        <div key="clock">
          <WidgetContainer title="" className="h-full" editMode={editMode}>
            <Clock />
          </WidgetContainer>
        </div>
        <div key="weather">
          <WidgetContainer title="Weather" className="h-full" editMode={editMode}>
            <Weather
              apiKey={settings?.weatherApiKey ?? ''}
              location={settings?.weatherLocation ?? ''}
            />
          </WidgetContainer>
        </div>
        <div key="countdown">
          <WidgetContainer title="Upcoming" className="h-full" editMode={editMode}>
            <Countdown events={countdownEvents} />
          </WidgetContainer>
        </div>
        <div key="calendar">
          <WidgetContainer title="Calendar" className="h-full" editMode={editMode}>
            <Calendar events={calendarEvents} accessToken={accessToken} />
          </WidgetContainer>
        </div>
      </GridLayout>
    </div>
  )
}

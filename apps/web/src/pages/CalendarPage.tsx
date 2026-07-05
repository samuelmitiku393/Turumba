import { useState, useMemo, useCallback } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, type View, Views } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { parse } from 'date-fns/parse'
import { startOfWeek } from 'date-fns/startOfWeek'
import { startOfMonth } from 'date-fns/startOfMonth'
import { endOfMonth } from 'date-fns/endOfMonth'
import { endOfWeek } from 'date-fns/endOfWeek'
import { getDay } from 'date-fns/getDay'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scheduleApi, channelsApi } from '../api/endpoints'
import type { Ad } from '../types'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

/** Returns the visible [start, end] window for a given view + date. */
function getViewRange(view: View, date: Date): { start: string; end: string } {
  let start: Date
  let end: Date

  if (view === Views.MONTH) {
    // Extend a week either side so the calendar's leading/trailing days are included
    start = startOfWeek(startOfMonth(date))
    end = endOfWeek(endOfMonth(date))
  } else if (view === Views.WEEK) {
    start = startOfWeek(date)
    end = endOfWeek(date)
  } else {
    // Day view — just fetch that single day ± a tiny buffer
    start = new Date(date); start.setHours(0, 0, 0, 0)
    end   = new Date(date); end.setHours(23, 59, 59, 999)
  }

  return { start: start.toISOString(), end: end.toISOString() }
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>(Views.WEEK)
  const [date, setDate] = useState(new Date())
  const [channelId, setChannelId] = useState('')

  const range = useMemo(() => getViewRange(view, date), [view, date])

  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: channelsApi.list })
  const { data: ads, isLoading } = useQuery({
    queryKey: ['schedule', { channelId, start: range.start, end: range.end }],
    queryFn: () => scheduleApi.list({ channelId, start: range.start, end: range.end }),
  })

  const events = useMemo(() => {
    if (!ads) return []
    return ads.map(ad => {
      const start = new Date(ad.scheduledAt!)
      const end = new Date(start.getTime() + 60 * 60 * 1000) // 1-hour block
      return { id: ad.id, title: ad.title, start, end, ad }
    })
  }, [ads])

  const eventPropGetter = (event: { ad: Ad }) => ({
    style: {
      backgroundColor: event.ad.channel.color,
      opacity: event.ad.status === 'ACTIVE' ? 0.6 : 1,
    }
  })

  // Keep view and date in sync when the calendar navigates
  const handleNavigate = useCallback((newDate: Date) => setDate(newDate), [])
  const handleViewChange = useCallback((newView: View) => setView(newView), [])

  return (
    <div className="flex flex-col h-full bg-[var(--tg-secondary)]">
      <div className="bg-[var(--tg-bg)] px-4 py-3 border-b border-[var(--tg-border)] flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--tg-text)]">Calendar</h1>
        <select
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
          className="input h-9 py-0 text-xs w-auto max-w-[140px] truncate rounded-full"
        >
          <option value="">All Channels</option>
          {channels?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex-1 p-2 h-[calc(100dvh-120px)]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><div className="animate-pulse">Loading...</div></div>
        ) : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={handleViewChange}
            date={date}
            onNavigate={handleNavigate}
            onSelectEvent={(e: any) => navigate(`/ads/${e.id}`)}
            eventPropGetter={eventPropGetter}
            views={['month', 'week', 'day']}
            popup
            selectable
            onSelectSlot={(slotInfo) => navigate(`/ads/new?date=${slotInfo.start.toISOString()}`)}
            className="bg-[var(--tg-bg)] rounded-xl border border-[var(--tg-border)] overflow-hidden text-sm"
          />
        )}
      </div>
    </div>
  )
}

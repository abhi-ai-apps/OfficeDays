'use client'
import useSWR from 'swr'
import { AttendanceDonut } from '@/components/AttendanceDonut'
import { StatGrid } from '@/components/StatGrid'
import { CalendarHeatmap } from '@/components/CalendarHeatmap'
import { RecommendationStrip } from '@/components/RecommendationStrip'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { computeStats } from '@/lib/attendance'
import { getRecommendations } from '@/lib/weather'
import { UserSettings, CalendarEvent, Holiday, WeatherDay } from '@/lib/types'

class FetchError extends Error {
  status: number
  constructor(status: number) {
    super('fetch failed')
    this.status = status
  }
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new FetchError(r.status)
  return r.json()
})

export function DashboardClient() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const { data: settings, error: settingsErr } = useSWR<UserSettings>('/api/settings', fetcher)
  const { data: holidays, error: holidaysErr } = useSWR<Holiday[]>(
    settings ? `/api/holidays?country=${settings.country}&year=${year}` : null,
    fetcher
  )
  const { data: events, error: eventsErr, mutate: mutateEvents, isValidating: syncingEvents } = useSWR<CalendarEvent[]>(
    settings ? `/api/calendar?month=${monthStr}&keyword=${encodeURIComponent(settings.keyword)}` : null,
    fetcher
  )
  const { data: forecast } = useSWR<WeatherDay[]>(
    settings?.lat && settings?.lon ? `/api/weather?lat=${settings.lat}&lon=${settings.lon}` : null,
    fetcher
  )
  const { data: companyHolidays, mutate: mutateCompanyHolidays } = useSWR<string[]>(
    '/api/company-holidays',
    fetcher
  )

  async function toggleCompanyHoliday(date: string) {
    await fetch('/api/company-holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    mutateCompanyHolidays()
  }

  const isAuthError = [settingsErr, holidaysErr, eventsErr].some(
    e => e instanceof FetchError && e.status === 401
  )

  if (settingsErr || holidaysErr || eventsErr) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400">
          {isAuthError ? (
            <>
              <p className="font-medium text-slate-200 mb-1">Session expired</p>
              <p className="text-sm mb-3">Your Google login has expired. Sign out and back in to continue.</p>
              <a
                href="/api/auth/signout"
                className="inline-block text-sm px-4 py-1.5 rounded-md bg-blue-700 text-white hover:bg-blue-600 transition-colors"
              >
                Sign out &amp; reconnect
              </a>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-200 mb-1">Something went wrong</p>
              <p className="text-sm">Try refreshing the page. If the problem persists, sign out and back in.</p>
            </>
          )}
        </div>
      </main>
    )
  }

  if (!settings || !holidays || !events) return <DashboardSkeleton />

  const allHolidays = [
    ...holidays,
    ...(companyHolidays ?? []).map(date => ({ date, localName: 'Company Holiday' })),
  ]
  const stats = computeStats(year, month, events, allHolidays, settings.targetPct, today)
  const recs = forecast ? getRecommendations(stats.remaining, forecast, stats.stillNeeded) : []

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => mutateEvents()}
          disabled={syncingEvents}
          title="Sync with Google Calendar"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 disabled:opacity-50 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3.5 h-3.5 ${syncingEvents ? 'animate-spin' : ''}`}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {syncingEvents ? 'Syncing…' : 'Sync calendar'}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800 rounded-xl p-4">
        <AttendanceDonut attendancePct={stats.attendancePct} targetPct={settings.targetPct} />
        <StatGrid
          attendedCount={stats.attendedCount}
          workingDaysTotal={stats.workingDays.length}
          remainingCount={stats.remaining.length}
          stillNeeded={stats.stillNeeded}
        />
      </div>
      <CalendarHeatmap
        year={year}
        month={month}
        workingDays={stats.workingDays}
        attended={stats.attended}
        holidays={holidays.map(h => h.date)}
        companyHolidays={companyHolidays ?? []}
        today={today}
        onToggleCompanyHoliday={toggleCompanyHoliday}
      />
      {stats.attendedCount === 0 && (
        <p className="text-xs text-slate-500 text-center -mt-2">
          No events matched keyword &quot;{settings.keyword}&quot;.{' '}
          <a href="/settings" className="text-sky-400 underline">Check your keyword in Settings.</a>
        </p>
      )}
      <RecommendationStrip
        recommendations={recs}
        stillNeeded={stats.stillNeeded}
        hasLocation={!!(settings.lat && settings.lon)}
      />
    </main>
  )
}

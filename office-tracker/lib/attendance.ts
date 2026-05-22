import { CalendarEvent, Holiday, AttendanceStats } from './types'

function toLocalISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getWeekdays(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(toLocalISO(date))
    }
    date.setDate(date.getDate() + 1)
  }
  return days
}

export function computeStats(
  year: number,
  month: number,
  events: CalendarEvent[],
  holidays: Holiday[],
  targetPct: number,
  today: string
): AttendanceStats {
  const holidayDates = new Set(holidays.map(h => h.date))
  const workingDays = getWeekdays(year, month).filter(d => !holidayDates.has(d))
  const attendedSet = new Set(events.map(e => e.date))
  const attended = workingDays.filter(d => attendedSet.has(d))
  const attendedCount = attended.length
  const attendancePct = workingDays.length > 0 ? attendedCount / workingDays.length : 0
  const targetCount = Math.ceil(targetPct * workingDays.length)
  const stillNeeded = Math.max(0, targetCount - attendedCount)
  const remaining = workingDays.filter(d => d >= today)
  return { workingDays, attended, attendedCount, attendancePct, targetCount, stillNeeded, remaining }
}

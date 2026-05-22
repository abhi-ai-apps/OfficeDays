import { getWeekdays, computeStats } from '@/lib/attendance'
import { CalendarEvent, Holiday } from '@/lib/types'

describe('getWeekdays', () => {
  it('returns only Mon–Fri for May 2026', () => {
    const days = getWeekdays(2026, 5)
    expect(days.every(d => {
      const dow = new Date(d + 'T12:00:00').getDay()
      return dow >= 1 && dow <= 5
    })).toBe(true)
  })

  it('returns 21 working days for May 2026', () => {
    expect(getWeekdays(2026, 5)).toHaveLength(21)
  })

  it('returns ISO date strings starting from first weekday', () => {
    const days = getWeekdays(2026, 5)
    expect(days[0]).toBe('2026-05-01') // May 1 2026 is a Friday
  })
})

describe('computeStats', () => {
  const holidays: Holiday[] = [{ date: '2026-05-01', localName: 'Labour Day' }]
  const events: CalendarEvent[] = [
    { date: '2026-05-04', title: 'office' },
    { date: '2026-05-05', title: 'office' },
    { date: '2026-05-06', title: 'office' },
  ]
  const today = '2026-05-10'

  it('excludes holidays from working days', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.workingDays).not.toContain('2026-05-01')
    expect(stats.workingDays).toHaveLength(20) // 21 weekdays - 1 holiday
  })

  it('counts attended days correctly', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.attendedCount).toBe(3)
  })

  it('computes stillNeeded correctly', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    // targetCount = ceil(0.6 * 20) = 12, attended = 3, stillNeeded = 9
    expect(stats.stillNeeded).toBe(9)
  })

  it('stillNeeded is 0 when target already met', () => {
    // 12 valid working days = ceil(0.6 * 20) target exactly met
    const fullEvents: CalendarEvent[] = [
      '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
      '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
      '2026-05-18', '2026-05-19',
    ].map(date => ({ date, title: 'office' }))
    const stats = computeStats(2026, 5, fullEvents, holidays, 0.6, today)
    expect(stats.stillNeeded).toBe(0)
  })

  it('remaining only includes days after today', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.remaining.every(d => d > today)).toBe(true)
  })
})

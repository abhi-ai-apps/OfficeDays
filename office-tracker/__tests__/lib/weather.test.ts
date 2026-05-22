import { weatherScore, getWmoIcon, getRecommendations } from '@/lib/weather'
import { WeatherDay } from '@/lib/types'

describe('weatherScore', () => {
  it('returns 100 for perfect conditions', () => {
    expect(weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 0, weatherCode: 0 })).toBe(100)
  })

  it('penalises rain heavily', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 100, weatherCode: 0 })
    expect(score).toBe(40) // 100 - (100 * 0.6)
  })

  it('penalises extreme heat', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 40, precipProbability: 0, weatherCode: 0 })
    expect(score).toBe(80) // 100 - 20
  })

  it('penalises drizzle / light rain weather code', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 0, weatherCode: 61 })
    expect(score).toBe(80) // 100 - 20
  })

  it('penalises storm weather code', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 0, weatherCode: 95 })
    expect(score).toBe(60) // 100 - 40
  })
})

describe('getWmoIcon', () => {
  it('returns sun for code 0', () => expect(getWmoIcon(0)).toBe('☀️'))
  it('returns cloud for code 2', () => expect(getWmoIcon(2)).toBe('⛅'))
  it('returns rain for code 80', () => expect(getWmoIcon(80)).toBe('🌧️'))
  it('returns storm for code 95', () => expect(getWmoIcon(95)).toBe('⛈️'))
})

describe('getRecommendations', () => {
  const remaining = ['2026-05-26', '2026-05-27', '2026-05-28']
  const forecast: WeatherDay[] = [
    { date: '2026-05-26', tempMax: 28, precipProbability: 5, weatherCode: 0 },   // best score
    { date: '2026-05-27', tempMax: 25, precipProbability: 70, weatherCode: 80 }, // worst score
    { date: '2026-05-28', tempMax: 26, precipProbability: 15, weatherCode: 2 },  // second best
  ]

  it('returns all forecast days in chronological order', () => {
    const recs = getRecommendations(remaining, forecast, 2)
    expect(recs).toHaveLength(3)
    expect(recs[0].date).toBe('2026-05-26')
    expect(recs[1].date).toBe('2026-05-27')
    expect(recs[2].date).toBe('2026-05-28')
  })

  it('marks the best stillNeeded days as recommended', () => {
    const recs = getRecommendations(remaining, forecast, 2)
    expect(recs.find(r => r.date === '2026-05-26')!.recommended).toBe(true)  // best
    expect(recs.find(r => r.date === '2026-05-28')!.recommended).toBe(true)  // second best
    expect(recs.find(r => r.date === '2026-05-27')!.recommended).toBe(false) // worst
  })

  it('marks all days recommended when stillNeeded >= forecast days', () => {
    const recs = getRecommendations(remaining, forecast, 5)
    expect(recs.every(r => r.recommended)).toBe(true)
  })

  it('marks no days recommended when stillNeeded is 0', () => {
    const recs = getRecommendations(remaining, forecast, 0)
    expect(recs.every(r => !r.recommended)).toBe(true)
  })

  it('skips days not in forecast', () => {
    const recs = getRecommendations(['2026-06-01', ...remaining], forecast, 3)
    expect(recs.every(r => forecast.some(f => f.date === r.date))).toBe(true)
  })

  it('returns empty array when remaining is empty', () => {
    expect(getRecommendations([], forecast, 2)).toHaveLength(0)
  })
})

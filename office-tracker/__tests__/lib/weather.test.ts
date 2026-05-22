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
    { date: '2026-05-26', tempMax: 28, precipProbability: 5, weatherCode: 0 },
    { date: '2026-05-27', tempMax: 25, precipProbability: 70, weatherCode: 80 },
    { date: '2026-05-28', tempMax: 26, precipProbability: 15, weatherCode: 2 },
  ]

  it('returns top N days by score', () => {
    const recs = getRecommendations(remaining, forecast, 2)
    expect(recs).toHaveLength(2)
    expect(recs[0].date).toBe('2026-05-26') // best score
    expect(recs[1].date).toBe('2026-05-28') // second best
  })

  it('skips days not in forecast', () => {
    const recs = getRecommendations(['2026-06-01', ...remaining], forecast, 3)
    expect(recs.every(r => forecast.some(f => f.date === r.date))).toBe(true)
  })

  it('returns empty array when count is 0', () => {
    expect(getRecommendations(remaining, forecast, 0)).toHaveLength(0)
  })
})

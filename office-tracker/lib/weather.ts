import { WeatherDay, Recommendation } from './types'

export function weatherScore(day: WeatherDay): number {
  let score = 100
  score -= day.precipProbability * 0.6   // precipProbability is 0–100; max 60 penalty
  if (day.tempMax > 38) score -= 20
  if (day.weatherCode >= 80) score -= 40        // heavy rain / thunderstorm
  else if (day.weatherCode >= 51) score -= 20   // drizzle / light-moderate rain
  return Math.max(0, score)
}

export function getWmoIcon(weatherCode: number): string {
  if (weatherCode === 0) return '☀️'
  if (weatherCode <= 3) return '⛅'
  if (weatherCode <= 48) return '🌫️'
  if (weatherCode <= 67) return '🌦️'
  if (weatherCode <= 77) return '❄️'
  if (weatherCode <= 82) return '🌧️'
  return '⛈️'
}

export function getRecommendations(
  remaining: string[],
  forecast: WeatherDay[],
  count: number
): Recommendation[] {
  if (count <= 0) return []
  const forecastMap = new Map(forecast.map(f => [f.date, f]))
  return remaining
    .filter(d => forecastMap.has(d))
    .map(d => {
      const w = forecastMap.get(d)!
      return { date: d, score: weatherScore(w), tempMax: w.tempMax, precipProbability: w.precipProbability, weatherCode: w.weatherCode }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}

import { WeatherCard } from './WeatherCard'
import { Recommendation } from '@/lib/types'

interface Props {
  recommendations: Recommendation[]
  stillNeeded: number
  hasLocation: boolean
}

export function RecommendationStrip({ recommendations, stillNeeded, hasLocation }: Props) {
  if (!hasLocation) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-center text-sm text-slate-400">
        Set your location in{' '}
        <a href="/settings" className="text-sky-400 underline">Settings</a>{' '}
        to see weather recommendations.
      </div>
    )
  }

  if (stillNeeded === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-center font-semibold text-green-400">
        You've hit your target! 🎉
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-center text-sm text-slate-400">
        No upcoming working days in the forecast window.
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
        Recommended days (next 7 days)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {recommendations.map(rec => (
          <WeatherCard key={rec.date} rec={rec} />
        ))}
      </div>
    </div>
  )
}

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

  const goCount = recommendations.filter(r => r.recommended).length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Remaining days forecast
        </div>
        <div className="text-xs text-slate-500">
          {goCount} Go · {recommendations.length - goCount} Skip
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {recommendations.map(rec => (
          <WeatherCard key={rec.date} rec={rec} />
        ))}
      </div>
    </div>
  )
}

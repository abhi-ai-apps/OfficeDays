import { getWmoIcon } from '@/lib/weather'
import { Recommendation } from '@/lib/types'

export function WeatherCard({ rec }: { rec: Recommendation }) {
  const date = new Date(rec.date + 'T12:00:00')
  const label = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  const isGood = rec.score > 70

  return (
    <div className={`bg-slate-800 rounded-xl p-3 text-center border-t-2 ${isGood ? 'border-green-500' : 'border-amber-500'}`}>
      <div className="text-2xl mb-1">{getWmoIcon(rec.weatherCode)}</div>
      <div className="text-xs font-semibold text-slate-200">{label}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{rec.tempMax}°C · {rec.precipProbability}% rain</div>
      <div className={`text-xs font-bold mt-1.5 ${isGood ? 'text-green-400' : 'text-amber-400'}`}>
        {isGood ? 'Go! ✓' : 'Maybe'}
      </div>
    </div>
  )
}

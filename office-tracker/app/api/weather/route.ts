import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { WeatherDay } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  const fetchForecast = unstable_cache(
    async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', lat)
      url.searchParams.set('longitude', lon)
      url.searchParams.set('daily', 'temperature_2m_max,precipitation_probability_max,weathercode')
      url.searchParams.set('timezone', 'auto')
      url.searchParams.set('forecast_days', '7')

      const res = await fetch(url.toString())
      if (!res.ok) return [] as WeatherDay[]
      const data = await res.json()

      return data.daily.time.map((date: string, i: number) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        precipProbability: data.daily.precipitation_probability_max[i],
        weatherCode: data.daily.weathercode[i],
      })) as WeatherDay[]
    },
    [`weather-${lat}-${lon}`],
    { revalidate: 60 * 60 * 3 }
  )

  return NextResponse.json(await fetchForecast())
}

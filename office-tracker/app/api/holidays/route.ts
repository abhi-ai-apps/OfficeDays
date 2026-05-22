import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { Holiday } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'IN'
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())

  const fetchHolidays = unstable_cache(
    async () => {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
      if (!res.ok) return [] as Holiday[]
      const data = await res.json()
      return data.map((h: { date: string; localName: string }) => ({
        date: h.date,
        localName: h.localName,
      })) as Holiday[]
    },
    [`holidays-${country}-${year}`],
    { revalidate: 60 * 60 * 24 * 7 }
  )

  return NextResponse.json(await fetchHolidays())
}

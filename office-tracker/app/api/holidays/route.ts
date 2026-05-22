import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Holiday } from '@/lib/types'

async function fetchHolidays(country: string, year: number): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((h: { date: string; localName: string }) => ({
    date: h.date,
    localName: h.localName,
  }))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'IN'
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'country must be a 2-letter ISO code' }, { status: 400 })
  }
  const yearParam = searchParams.get('year')
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be an integer between 2000 and 2100' }, { status: 400 })
  }

  const getCached = unstable_cache(
    () => fetchHolidays(country, year),
    [`holidays-${country}-${year}`],
    { revalidate: 60 * 60 * 24 * 7 }
  )

  return NextResponse.json(await getCached())
}

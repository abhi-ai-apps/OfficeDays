import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { kv } from '@vercel/kv'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const holidays = await kv.get<string[]>(`companyHolidays:${session.sub}`) ?? []
  return NextResponse.json(holidays)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date } = body
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const key = `companyHolidays:${session.sub}`
  const current = await kv.get<string[]>(key) ?? []
  const updated = current.includes(date)
    ? current.filter(d => d !== date)
    : [...current, date]

  await kv.set(key, updated)
  return NextResponse.json(updated)
}

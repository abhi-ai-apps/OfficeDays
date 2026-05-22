import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { kv } from '@vercel/kv'
import { authOptions } from '@/lib/auth'
import { UserSettings } from '@/lib/types'

const DEFAULT_SETTINGS: UserSettings = {
  targetPct: 0.6,
  keyword: 'office',
  country: 'IN',
  locationText: '',
  lat: null,
  lon: null,
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await kv.get<UserSettings>(`settings:${session.sub}`)
  if (!settings) {
    await kv.set(`settings:${session.sub}`, DEFAULT_SETTINGS)
    return NextResponse.json(DEFAULT_SETTINGS)
  }
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updated: UserSettings = { ...DEFAULT_SETTINGS, ...body }
  await kv.set(`settings:${session.sub}`, updated)
  return NextResponse.json(updated)
}

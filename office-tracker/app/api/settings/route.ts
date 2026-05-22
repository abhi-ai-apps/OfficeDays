import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { kv } from '@vercel/kv'
import { authOptions } from '@/lib/auth'
import { UserSettings } from '@/lib/types'

const DEFAULT_SETTINGS: UserSettings = {
  targetPct: 0.6,
  keyword: 'office',
  country: 'IE',
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

  // Allowlist and type-validate fields
  const safeBody: Partial<UserSettings> = {}
  if (typeof body.targetPct === 'number' && body.targetPct >= 0.1 && body.targetPct <= 1) {
    safeBody.targetPct = body.targetPct
  }
  if (typeof body.keyword === 'string' && body.keyword.trim().length > 0) {
    safeBody.keyword = body.keyword.trim()
  }
  if (typeof body.country === 'string' && /^[A-Z]{2}$/.test(body.country)) {
    safeBody.country = body.country
  }
  if (typeof body.locationText === 'string') {
    safeBody.locationText = body.locationText
  }
  if (body.lat === null || typeof body.lat === 'number') {
    safeBody.lat = body.lat
  }
  if (body.lon === null || typeof body.lon === 'number') {
    safeBody.lon = body.lon
  }

  const stored = await kv.get<UserSettings>(`settings:${session.sub}`)
  const updated: UserSettings = { ...DEFAULT_SETTINGS, ...(stored ?? {}), ...safeBody }
  await kv.set(`settings:${session.sub}`, updated)
  return NextResponse.json(updated)
}

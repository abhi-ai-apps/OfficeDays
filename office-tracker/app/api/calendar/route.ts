import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth'
import { CalendarEvent } from '@/lib/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const keyword = searchParams.get('keyword') ?? 'office'

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const [year, mon] = month.split('-').map(Number)
  const timeMin = new Date(year, mon - 1, 1).toISOString()
  const timeMax = new Date(year, mon, 0, 23, 59, 59).toISOString()

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  let res
  try {
    res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      q: keyword,
      singleEvents: true,
      orderBy: 'startTime',
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 401) return NextResponse.json({ error: 'Google auth expired' }, { status: 401 })
    return NextResponse.json({ error: 'Calendar API error' }, { status: 502 })
  }

  const events: CalendarEvent[] = (res.data.items ?? [])
    .filter(e => e.start?.date || e.start?.dateTime)
    .map(e => ({
      date: (e.start!.date ?? e.start!.dateTime!).slice(0, 10),
      title: e.summary ?? '',
    }))

  return NextResponse.json(events)
}

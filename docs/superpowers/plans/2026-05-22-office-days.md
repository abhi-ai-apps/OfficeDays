# Office Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal office attendance tracker that reads Google Calendar, computes attendance vs. a configurable target, and recommends weather-optimal days to go in.

**Architecture:** Next.js 14 App Router on Vercel. Server-side API routes proxy Google Calendar, Open-Meteo, and Nager.Date. Vercel KV (Upstash) stores per-user settings keyed by Google sub ID. All attendance and recommendation logic runs client-side after SWR fetches.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, NextAuth.js v4, `googleapis`, `@vercel/kv`, `swr`, Recharts (donut only), shadcn/ui optional.

---

## File Structure

```
office-tracker/
├── app/
│   ├── globals.css
│   ├── layout.tsx                    ← root layout + SessionProvider
│   ├── providers.tsx                 ← 'use client' SessionProvider wrapper
│   ├── page.tsx                      ← landing / sign-in (server component)
│   ├── dashboard/
│   │   ├── page.tsx                  ← auth guard (server component)
│   │   └── DashboardClient.tsx       ← SWR fetches + render (client component)
│   ├── settings/
│   │   ├── page.tsx                  ← auth guard (server component)
│   │   └── SettingsClient.tsx        ← form + save (client component)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── calendar/route.ts
│       ├── holidays/route.ts
│       ├── weather/route.ts
│       └── settings/route.ts
├── components/
│   ├── Nav.tsx                       ← top nav with active link state
│   ├── SignInButton.tsx              ← 'use client' Google sign-in trigger
│   ├── AttendanceDonut.tsx           ← SVG ring chart
│   ├── StatGrid.tsx                  ← 2×2 stat cards
│   ├── CalendarHeatmap.tsx           ← month grid with colour coding
│   ├── WeatherCard.tsx               ← single recommendation card
│   ├── RecommendationStrip.tsx       ← row of weather cards + empty states
│   └── DashboardSkeleton.tsx         ← loading pulse skeleton
├── lib/
│   ├── types.ts                      ← shared TypeScript interfaces
│   ├── auth.ts                       ← authOptions (exported for reuse)
│   ├── attendance.ts                 ← getWeekdays, computeStats (pure)
│   └── weather.ts                    ← weatherScore, getWmoIcon, getRecommendations (pure)
├── types/
│   └── next-auth.d.ts                ← session type augmentation
├── __tests__/
│   ├── lib/attendance.test.ts
│   ├── lib/weather.test.ts
│   ├── components/AttendanceDonut.test.tsx
│   ├── components/StatGrid.test.tsx
│   ├── components/CalendarHeatmap.test.tsx
│   └── components/RecommendationStrip.test.tsx
├── middleware.ts                     ← protect /dashboard + /settings
├── jest.config.ts
├── jest.setup.ts
└── .env.local                        ← gitignored
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `office-tracker/` (new Next.js project)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.local`

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@14 office-tracker \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd office-tracker
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth googleapis @vercel/kv swr
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest @types/jest
```

- [ ] **Step 3: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}

export default createJestConfig(config)
```

- [ ] **Step 4: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `.env.local`** (never commit this file)

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=run-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
KV_REST_API_URL=your-upstash-rest-url
KV_REST_API_TOKEN=your-upstash-rest-token
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: `▲ Next.js 14.x.x` on `http://localhost:3000` with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with jest"
```

---

## Task 2: Shared Types + Attendance Utilities

**Files:**
- Create: `lib/types.ts`
- Create: `lib/attendance.ts`
- Create: `__tests__/lib/attendance.test.ts`

- [ ] **Step 1: Write failing tests for attendance utilities**

Create `__tests__/lib/attendance.test.ts`:

```typescript
import { getWeekdays, computeStats } from '@/lib/attendance'
import { CalendarEvent, Holiday } from '@/lib/types'

describe('getWeekdays', () => {
  it('returns only Mon–Fri for May 2026', () => {
    const days = getWeekdays(2026, 5)
    expect(days.every(d => {
      const dow = new Date(d + 'T12:00:00').getDay()
      return dow >= 1 && dow <= 5
    })).toBe(true)
  })

  it('returns 21 working days for May 2026', () => {
    expect(getWeekdays(2026, 5)).toHaveLength(21)
  })

  it('returns ISO date strings', () => {
    const days = getWeekdays(2026, 5)
    expect(days[0]).toBe('2026-05-04') // first Monday
  })
})

describe('computeStats', () => {
  const holidays: Holiday[] = [{ date: '2026-05-01', localName: 'Labour Day' }]
  const events: CalendarEvent[] = [
    { date: '2026-05-04', title: 'office' },
    { date: '2026-05-05', title: 'office' },
    { date: '2026-05-06', title: 'office' },
  ]
  const today = '2026-05-10'

  it('excludes holidays from working days', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.workingDays).not.toContain('2026-05-01')
    expect(stats.workingDays).toHaveLength(20) // 21 - 1 holiday
  })

  it('counts attended days correctly', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.attendedCount).toBe(3)
  })

  it('computes stillNeeded correctly', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    // targetCount = ceil(0.6 * 20) = 12, attended = 3, stillNeeded = 9
    expect(stats.stillNeeded).toBe(9)
  })

  it('stillNeeded is 0 when target already met', () => {
    const fullEvents: CalendarEvent[] = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-05-${String(i + 4).padStart(2, '0')}`,
      title: 'office',
    }))
    const stats = computeStats(2026, 5, fullEvents, holidays, 0.6, today)
    expect(stats.stillNeeded).toBe(0)
  })

  it('remaining only includes days after today', () => {
    const stats = computeStats(2026, 5, events, holidays, 0.6, today)
    expect(stats.remaining.every(d => d > today)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/attendance.test.ts
```

Expected: `Cannot find module '@/lib/attendance'`

- [ ] **Step 3: Create `lib/types.ts`**

```typescript
export interface UserSettings {
  targetPct: number        // decimal: 0.6 = 60%
  keyword: string
  country: string          // ISO 3166-1 alpha-2: "IN"
  locationText: string     // display name: "Bangalore, India"
  lat: number | null
  lon: number | null
}

export interface CalendarEvent {
  date: string             // "2026-05-15"
  title: string
}

export interface Holiday {
  date: string             // "2026-05-01"
  localName: string
}

export interface WeatherDay {
  date: string             // "2026-05-26"
  tempMax: number          // Celsius
  precipProbability: number // 0–100
  weatherCode: number      // WMO code
}

export interface AttendanceStats {
  workingDays: string[]
  attended: string[]
  attendedCount: number
  attendancePct: number
  targetCount: number
  stillNeeded: number
  remaining: string[]
}

export interface Recommendation {
  date: string
  score: number
  tempMax: number
  precipProbability: number
  weatherCode: number
}
```

- [ ] **Step 4: Create `lib/attendance.ts`**

```typescript
import { CalendarEvent, Holiday, AttendanceStats } from './types'

export function getWeekdays(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(date.toISOString().slice(0, 10))
    }
    date.setDate(date.getDate() + 1)
  }
  return days
}

export function computeStats(
  year: number,
  month: number,
  events: CalendarEvent[],
  holidays: Holiday[],
  targetPct: number,
  today: string
): AttendanceStats {
  const holidayDates = new Set(holidays.map(h => h.date))
  const workingDays = getWeekdays(year, month).filter(d => !holidayDates.has(d))
  const attendedSet = new Set(events.map(e => e.date))
  const attended = workingDays.filter(d => attendedSet.has(d))
  const attendedCount = attended.length
  const attendancePct = workingDays.length > 0 ? attendedCount / workingDays.length : 0
  const targetCount = Math.ceil(targetPct * workingDays.length)
  const stillNeeded = Math.max(0, targetCount - attendedCount)
  const remaining = workingDays.filter(d => d > today)
  return { workingDays, attended, attendedCount, attendancePct, targetCount, stillNeeded, remaining }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/lib/attendance.test.ts
```

Expected: `Tests: 6 passed`

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/attendance.ts __tests__/lib/attendance.test.ts
git commit -m "feat: add shared types and attendance utility functions"
```

---

## Task 3: Weather Utilities

**Files:**
- Create: `lib/weather.ts`
- Create: `__tests__/lib/weather.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/weather.test.ts`:

```typescript
import { weatherScore, getWmoIcon, getRecommendations } from '@/lib/weather'
import { WeatherDay, Recommendation } from '@/lib/types'

describe('weatherScore', () => {
  it('returns 100 for perfect conditions', () => {
    expect(weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 0, weatherCode: 0 })).toBe(100)
  })

  it('penalises rain heavily', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 100, weatherCode: 0 })
    expect(score).toBe(40) // 100 - (100 * 0.6)
  })

  it('penalises extreme heat', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 40, precipProbability: 0, weatherCode: 0 })
    expect(score).toBe(80) // 100 - 20
  })

  it('penalises storm weather code', () => {
    const score = weatherScore({ date: '2026-05-26', tempMax: 25, precipProbability: 0, weatherCode: 95 })
    expect(score).toBe(60) // 100 - 40
  })
})

describe('getWmoIcon', () => {
  it('returns sun for code 0', () => expect(getWmoIcon(0)).toBe('☀️'))
  it('returns cloud for code 2', () => expect(getWmoIcon(2)).toBe('⛅'))
  it('returns rain for code 80', () => expect(getWmoIcon(80)).toBe('🌧️'))
  it('returns storm for code 95', () => expect(getWmoIcon(95)).toBe('⛈️'))
})

describe('getRecommendations', () => {
  const remaining = ['2026-05-26', '2026-05-27', '2026-05-28']
  const forecast: WeatherDay[] = [
    { date: '2026-05-26', tempMax: 28, precipProbability: 5, weatherCode: 0 },
    { date: '2026-05-27', tempMax: 25, precipProbability: 70, weatherCode: 80 },
    { date: '2026-05-28', tempMax: 26, precipProbability: 15, weatherCode: 2 },
  ]

  it('returns top N days by score', () => {
    const recs = getRecommendations(remaining, forecast, 2)
    expect(recs).toHaveLength(2)
    expect(recs[0].date).toBe('2026-05-26') // best score
    expect(recs[1].date).toBe('2026-05-28') // second best
  })

  it('skips days not in forecast', () => {
    const recs = getRecommendations(['2026-06-01', ...remaining], forecast, 3)
    expect(recs.every(r => forecast.some(f => f.date === r.date))).toBe(true)
  })

  it('returns empty array when count is 0', () => {
    expect(getRecommendations(remaining, forecast, 0)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest __tests__/lib/weather.test.ts
```

Expected: `Cannot find module '@/lib/weather'`

- [ ] **Step 3: Create `lib/weather.ts`**

```typescript
import { WeatherDay, Recommendation } from './types'

export function weatherScore(day: WeatherDay): number {
  let score = 100
  score -= day.precipProbability * 0.6   // max 60 penalty (precipProbability is 0–100)
  if (day.tempMax > 38) score -= 20
  if (day.weatherCode >= 80) score -= 40
  return score
}

export function getWmoIcon(weatherCode: number): string {
  if (weatherCode === 0) return '☀️'
  if (weatherCode <= 3) return '⛅'
  if (weatherCode <= 48) return '🌫️'
  if (weatherCode <= 67) return '🌦️'
  if (weatherCode <= 77) return '❄️'
  if (weatherCode <= 82) return '🌧️'
  return '⛈️'
}

export function getRecommendations(
  remaining: string[],
  forecast: WeatherDay[],
  count: number
): Recommendation[] {
  if (count === 0) return []
  const forecastMap = new Map(forecast.map(f => [f.date, f]))
  return remaining
    .filter(d => forecastMap.has(d))
    .map(d => {
      const w = forecastMap.get(d)!
      return { date: d, score: weatherScore(w), tempMax: w.tempMax, precipProbability: w.precipProbability, weatherCode: w.weatherCode }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/weather.test.ts
```

Expected: `Tests: 9 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/weather.ts __tests__/lib/weather.test.ts
git commit -m "feat: add weather scoring and recommendation utilities"
```

---

## Task 4: NextAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create `lib/auth.ts`**

```typescript
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.sub = token.sub as string
      return session
    },
  },
}
```

- [ ] **Step 2: Create `types/next-auth.d.ts`**

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    sub: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
  }
}
```

- [ ] **Step 3: Create `app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create `middleware.ts`**

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
}
```

- [ ] **Step 5: Verify auth is wired up**

```bash
npm run dev
```

Navigate to `http://localhost:3000/api/auth/providers` — expected: JSON with `google` provider listed.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth middleware.ts
git commit -m "feat: add NextAuth with Google OAuth and route protection"
```

---

## Task 5: `/api/settings` Route

**Files:**
- Create: `app/api/settings/route.ts`
- Create: `__tests__/api/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/settings.test.ts`:

```typescript
import { GET, PATCH } from '@/app/api/settings/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@vercel/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }))

import { getServerSession } from 'next-auth'
import { kv } from '@vercel/kv'

const mockSession = { accessToken: 'tok', sub: 'user-123' }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/settings', () => {
  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns defaults and writes them when key not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(kv.get as jest.Mock).mockResolvedValue(null)
    ;(kv.set as jest.Mock).mockResolvedValue('OK')

    const res = await GET()
    const body = await res.json()

    expect(body.targetPct).toBe(0.6)
    expect(body.keyword).toBe('office')
    expect(kv.set).toHaveBeenCalledWith('settings:user-123', expect.objectContaining({ targetPct: 0.6 }))
  })

  it('returns stored settings when key exists', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const stored = { targetPct: 0.7, keyword: 'wfo', country: 'US', locationText: 'New York', lat: 40.7, lon: -74.0 }
    ;(kv.get as jest.Mock).mockResolvedValue(stored)

    const res = await GET()
    expect(await res.json()).toEqual(stored)
  })
})

describe('PATCH /api/settings', () => {
  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ keyword: 'wfo' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('merges and saves settings', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(kv.set as jest.Mock).mockResolvedValue('OK')

    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ keyword: 'wfo', targetPct: 0.8 }),
    })
    const res = await PATCH(req)
    const body = await res.json()

    expect(body.keyword).toBe('wfo')
    expect(body.targetPct).toBe(0.8)
    expect(kv.set).toHaveBeenCalledWith('settings:user-123', expect.objectContaining({ keyword: 'wfo' }))
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest __tests__/api/settings.test.ts
```

Expected: `Cannot find module '@/app/api/settings/route'`

- [ ] **Step 3: Create `app/api/settings/route.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/api/settings.test.ts
```

Expected: `Tests: 5 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/settings __tests__/api/settings.test.ts
git commit -m "feat: add /api/settings route backed by Vercel KV"
```

---

## Task 6: `/api/calendar` and `/api/holidays` Routes

**Files:**
- Create: `app/api/calendar/route.ts`
- Create: `app/api/holidays/route.ts`

- [ ] **Step 1: Create `app/api/calendar/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth'
import { CalendarEvent } from '@/lib/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')   // "2026-05"
  const keyword = searchParams.get('keyword') ?? 'office'

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [year, mon] = month.split('-').map(Number)
  const timeMin = new Date(year, mon - 1, 1).toISOString()
  const timeMax = new Date(year, mon, 0, 23, 59, 59).toISOString()

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    q: keyword,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events: CalendarEvent[] = (res.data.items ?? [])
    .filter(e => e.start?.date || e.start?.dateTime)
    .map(e => ({
      date: (e.start!.date ?? e.start!.dateTime!).slice(0, 10),
      title: e.summary ?? '',
    }))

  return NextResponse.json(events)
}
```

- [ ] **Step 2: Create `app/api/holidays/route.ts`**

```typescript
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
```

- [ ] **Step 3: Create `app/api/weather/route.ts`**

```typescript
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
```

- [ ] **Step 4: Manual smoke test**

With the dev server running and signed in, open:
`http://localhost:3000/api/holidays?country=IN&year=2026`

Expected: JSON array with Indian public holidays.

- [ ] **Step 5: Commit**

```bash
git add app/api/calendar app/api/holidays app/api/weather
git commit -m "feat: add calendar, holidays, and weather API routes"
```

---

## Task 7: App Shell (Layout, Landing, Nav)

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/providers.tsx`
- Modify: `app/page.tsx`
- Create: `components/Nav.tsx`
- Create: `components/SignInButton.tsx`

- [ ] **Step 1: Create `app/providers.tsx`**

```typescript
'use client'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Office Days',
  description: 'Track your office attendance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `components/SignInButton.tsx`**

```typescript
'use client'
import { signIn } from 'next-auth/react'

export function SignInButton() {
  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
    >
      Sign in with Google
    </button>
  )
}
```

- [ ] **Step 4: Replace `app/page.tsx`**

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { SignInButton } from '@/components/SignInButton'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-100">Office Days</h1>
        <p className="text-slate-400">Track your office attendance against your monthly target.</p>
        <SignInButton />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Create `components/Nav.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav() {
  const pathname = usePathname()
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm px-4 py-1.5 rounded-md transition-colors ${
        pathname === href
          ? 'bg-blue-700 text-white'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 h-14 flex items-center justify-between">
      <span className="text-sm font-bold tracking-widest text-slate-100">OFFICE DAYS</span>
      <div className="flex gap-1">
        {link('/dashboard', 'Dashboard')}
        {link('/settings', 'Settings')}
      </div>
    </nav>
  )
}
```

- [ ] **Step 6: Verify sign-in flow manually**

```bash
npm run dev
```

Visit `http://localhost:3000` → click "Sign in with Google" → complete OAuth → should land on `/dashboard` (404 is OK, page doesn't exist yet).

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/providers.tsx app/page.tsx components/Nav.tsx components/SignInButton.tsx
git commit -m "feat: add app shell, landing page, and nav"
```

---

## Task 8: AttendanceDonut Component

**Files:**
- Create: `components/AttendanceDonut.tsx`
- Create: `__tests__/components/AttendanceDonut.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/AttendanceDonut.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { AttendanceDonut } from '@/components/AttendanceDonut'

describe('AttendanceDonut', () => {
  it('displays attendance percentage as integer', () => {
    render(<AttendanceDonut attendancePct={0.47} targetPct={0.6} />)
    expect(screen.getByText('47%')).toBeInTheDocument()
  })

  it('displays target percentage', () => {
    render(<AttendanceDonut attendancePct={0.47} targetPct={0.6} />)
    expect(screen.getByText('of 60%')).toBeInTheDocument()
  })

  it('caps display at 100% when over-attended', () => {
    render(<AttendanceDonut attendancePct={1.1} targetPct={0.6} />)
    expect(screen.getByText('110%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest __tests__/components/AttendanceDonut.test.tsx
```

Expected: `Cannot find module '@/components/AttendanceDonut'`

- [ ] **Step 3: Create `components/AttendanceDonut.tsx`**

```typescript
interface Props {
  attendancePct: number   // 0 to 1+
  targetPct: number       // 0 to 1
}

const R = 22
const C = 2 * Math.PI * R  // ≈ 138.23

export function AttendanceDonut({ attendancePct, targetPct }: Props) {
  const fillOffset = C * (1 - Math.min(attendancePct, 1))

  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90 w-full h-full">
        <circle cx="30" cy="30" r={R} fill="none" stroke="#334155" strokeWidth="8" />
        <circle
          cx="30" cy="30" r={R}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="8"
          strokeDasharray={C}
          strokeDashoffset={fillOffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        <circle
          cx="30" cy="30" r={R}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray={`2 ${C - 2}`}
          strokeDashoffset={C * (1 - targetPct)}
        />
      </svg>
      <div className="z-10 text-center">
        <div className="text-sky-400 text-base font-bold leading-none">
          {Math.round(attendancePct * 100)}%
        </div>
        <div className="text-slate-500 text-[10px] mt-0.5">
          of {Math.round(targetPct * 100)}%
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/AttendanceDonut.test.tsx
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add components/AttendanceDonut.tsx __tests__/components/AttendanceDonut.test.tsx
git commit -m "feat: add AttendanceDonut SVG ring component"
```

---

## Task 9: StatGrid Component

**Files:**
- Create: `components/StatGrid.tsx`
- Create: `__tests__/components/StatGrid.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/StatGrid.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { StatGrid } from '@/components/StatGrid'

describe('StatGrid', () => {
  const defaultProps = {
    attendedCount: 8,
    workingDaysTotal: 17,
    remainingCount: 9,
    stillNeeded: 3,
  }

  it('renders all four stat values', () => {
    render(<StatGrid {...defaultProps} />)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('applies red highlight to still-needed card when > 0', () => {
    render(<StatGrid {...defaultProps} />)
    const neededCard = screen.getByText('Still needed').closest('div')
    expect(neededCard).toHaveClass('bg-rose-500')
  })

  it('does not highlight still-needed when 0', () => {
    render(<StatGrid {...defaultProps} stillNeeded={0} />)
    const neededCard = screen.getByText('Still needed').closest('div')
    expect(neededCard).not.toHaveClass('bg-rose-500')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest __tests__/components/StatGrid.test.tsx
```

- [ ] **Step 3: Create `components/StatGrid.tsx`**

```typescript
interface Props {
  attendedCount: number
  workingDaysTotal: number
  remainingCount: number
  stillNeeded: number
}

export function StatGrid({ attendedCount, workingDaysTotal, remainingCount, stillNeeded }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 flex-1">
      <StatCard label="Attended" value={attendedCount} unit="days" />
      <StatCard label="Working days" value={workingDaysTotal} unit="total" />
      <StatCard label="Remaining" value={remainingCount} unit="days" />
      <StatCard label="Still needed" value={stillNeeded} unit="more" highlight={stillNeeded > 0} />
    </div>
  )
}

function StatCard({ label, value, unit, highlight = false }: {
  label: string; value: number; unit: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-rose-500' : 'bg-slate-700'}`}>
      <div className={`text-xs mb-0.5 ${highlight ? 'text-rose-200' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-white' : 'text-slate-100'}`}>
        {value}{' '}
        <span className={`text-xs font-normal ${highlight ? 'text-rose-200' : 'text-slate-500'}`}>{unit}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/StatGrid.test.tsx
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add components/StatGrid.tsx __tests__/components/StatGrid.test.tsx
git commit -m "feat: add StatGrid 2x2 stat cards component"
```

---

## Task 10: CalendarHeatmap Component

**Files:**
- Create: `components/CalendarHeatmap.tsx`
- Create: `__tests__/components/CalendarHeatmap.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/CalendarHeatmap.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { CalendarHeatmap } from '@/components/CalendarHeatmap'

const baseProps = {
  year: 2026,
  month: 5,
  workingDays: ['2026-05-04', '2026-05-05'],
  attended: ['2026-05-04'],
  holidays: ['2026-05-01'],
  today: '2026-05-04',
}

describe('CalendarHeatmap', () => {
  it('renders month name', () => {
    render(<CalendarHeatmap {...baseProps} />)
    expect(screen.getByText(/May 2026/i)).toBeInTheDocument()
  })

  it('renders legend items', () => {
    render(<CalendarHeatmap {...baseProps} />)
    expect(screen.getByText('Office')).toBeInTheDocument()
    expect(screen.getByText('Holiday')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders day header labels', () => {
    render(<CalendarHeatmap {...baseProps} />)
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.getByText('Fr')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest __tests__/components/CalendarHeatmap.test.tsx
```

- [ ] **Step 3: Create `components/CalendarHeatmap.tsx`**

```typescript
interface Props {
  year: number
  month: number
  workingDays: string[]
  attended: string[]
  holidays: string[]
  today: string
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function CalendarHeatmap({ year, month, workingDays, attended, holidays, today }: Props) {
  const attendedSet = new Set(attended)
  const holidaySet = new Set(holidays)
  const workingSet = new Set(workingDays)

  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7  // Mon=0
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const toISO = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const cellBg = (day: number) => {
    const iso = toISO(day)
    if (attendedSet.has(iso)) return 'bg-sky-500'
    if (holidaySet.has(iso)) return 'bg-amber-500 opacity-60'
    const dow = new Date(iso + 'T12:00:00').getDay()
    if (dow === 0 || dow === 6) return 'bg-slate-900'
    return 'bg-slate-700'
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
        {monthName} {year}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className={`text-center text-[10px] ${d === 'Sa' || d === 'Su' ? 'text-slate-600' : 'text-slate-500'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div
            key={i}
            className={[
              'h-7 rounded',
              day ? cellBg(day) : '',
              day && toISO(day) === today ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : '',
            ].join(' ')}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <LegendItem color="bg-sky-500" label="Office" />
        <LegendItem color="bg-amber-500 opacity-60" label="Holiday" />
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-sky-400" />
          <span className="text-[10px] text-slate-500">Today</span>
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded ${color}`} />
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/CalendarHeatmap.test.tsx
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add components/CalendarHeatmap.tsx __tests__/components/CalendarHeatmap.test.tsx
git commit -m "feat: add CalendarHeatmap month grid component"
```

---

## Task 11: WeatherCard + RecommendationStrip Components

**Files:**
- Create: `components/WeatherCard.tsx`
- Create: `components/RecommendationStrip.tsx`
- Create: `__tests__/components/RecommendationStrip.test.tsx`

- [ ] **Step 1: Create `components/WeatherCard.tsx`**

```typescript
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
```

- [ ] **Step 2: Write failing tests for RecommendationStrip**

Create `__tests__/components/RecommendationStrip.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { RecommendationStrip } from '@/components/RecommendationStrip'
import { Recommendation } from '@/lib/types'

const rec: Recommendation = {
  date: '2026-05-26',
  score: 95,
  tempMax: 28,
  precipProbability: 5,
  weatherCode: 0,
}

describe('RecommendationStrip', () => {
  it('shows location prompt when no location configured', () => {
    render(<RecommendationStrip recommendations={[]} stillNeeded={3} hasLocation={false} />)
    expect(screen.getByText(/Set your location/i)).toBeInTheDocument()
  })

  it('shows target-met message when stillNeeded is 0', () => {
    render(<RecommendationStrip recommendations={[]} stillNeeded={0} hasLocation={true} />)
    expect(screen.getByText(/hit your target/i)).toBeInTheDocument()
  })

  it('renders weather cards when recommendations exist', () => {
    render(<RecommendationStrip recommendations={[rec]} stillNeeded={1} hasLocation={true} />)
    expect(screen.getByText('28°C · 5% rain')).toBeInTheDocument()
  })

  it('shows fallback when no forecast days in window', () => {
    render(<RecommendationStrip recommendations={[]} stillNeeded={2} hasLocation={true} />)
    expect(screen.getByText(/No upcoming/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify fail**

```bash
npx jest __tests__/components/RecommendationStrip.test.tsx
```

- [ ] **Step 4: Create `components/RecommendationStrip.tsx`**

```typescript
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
      <div className="grid grid-cols-3 gap-3">
        {recommendations.map(rec => (
          <WeatherCard key={rec.date} rec={rec} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/components/RecommendationStrip.test.tsx
```

Expected: `Tests: 4 passed`

- [ ] **Step 6: Commit**

```bash
git add components/WeatherCard.tsx components/RecommendationStrip.tsx __tests__/components/RecommendationStrip.test.tsx
git commit -m "feat: add WeatherCard and RecommendationStrip components"
```

---

## Task 12: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/DashboardClient.tsx`
- Create: `components/DashboardSkeleton.tsx`

- [ ] **Step 1: Create `components/DashboardSkeleton.tsx`**

```typescript
export function DashboardSkeleton() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">
        <div className="w-24 h-24 rounded-full bg-slate-700 flex-shrink-0" />
        <div className="grid grid-cols-2 gap-2 flex-1">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-700 rounded-lg h-16" />)}
        </div>
      </div>
      <div className="bg-slate-800 rounded-xl h-52" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl h-28" />)}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `app/dashboard/DashboardClient.tsx`**

```typescript
'use client'
import useSWR from 'swr'
import { AttendanceDonut } from '@/components/AttendanceDonut'
import { StatGrid } from '@/components/StatGrid'
import { CalendarHeatmap } from '@/components/CalendarHeatmap'
import { RecommendationStrip } from '@/components/RecommendationStrip'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { computeStats } from '@/lib/attendance'
import { getRecommendations } from '@/lib/weather'
import { UserSettings, CalendarEvent, Holiday, WeatherDay } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('fetch failed')
  return r.json()
})

export function DashboardClient() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.toISOString().slice(0, 10)
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const { data: settings } = useSWR<UserSettings>('/api/settings', fetcher)
  const { data: holidays } = useSWR<Holiday[]>(
    settings ? `/api/holidays?country=${settings.country}&year=${year}` : null,
    fetcher
  )
  const { data: events } = useSWR<CalendarEvent[]>(
    settings ? `/api/calendar?month=${monthStr}&keyword=${encodeURIComponent(settings.keyword)}` : null,
    fetcher
  )
  const { data: forecast } = useSWR<WeatherDay[]>(
    settings?.lat && settings?.lon ? `/api/weather?lat=${settings.lat}&lon=${settings.lon}` : null,
    fetcher
  )

  if (!settings || !holidays || !events) return <DashboardSkeleton />

  const stats = computeStats(year, month, events, holidays, settings.targetPct, today)
  const recs = forecast ? getRecommendations(stats.remaining, forecast, stats.stillNeeded) : []

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">
        <AttendanceDonut attendancePct={stats.attendancePct} targetPct={settings.targetPct} />
        <StatGrid
          attendedCount={stats.attendedCount}
          workingDaysTotal={stats.workingDays.length}
          remainingCount={stats.remaining.length}
          stillNeeded={stats.stillNeeded}
        />
      </div>
      <CalendarHeatmap
        year={year}
        month={month}
        workingDays={stats.workingDays}
        attended={stats.attended}
        holidays={holidays.map(h => h.date)}
        today={today}
      />
      <RecommendationStrip
        recommendations={recs}
        stillNeeded={stats.stillNeeded}
        hasLocation={!!(settings.lat && settings.lon)}
      />
    </main>
  )
}
```

- [ ] **Step 3: Create `app/dashboard/page.tsx`**

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Nav } from '@/components/Nav'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  return (
    <>
      <Nav />
      <DashboardClient />
    </>
  )
}
```

- [ ] **Step 4: Manual end-to-end test**

```bash
npm run dev
```

1. Sign in with Google at `http://localhost:3000`
2. Should redirect to `/dashboard`
3. Skeleton shows briefly, then stats render
4. If you have events with the keyword "office" in Google Calendar this month, they appear in the heatmap

- [ ] **Step 5: Commit**

```bash
git add app/dashboard components/DashboardSkeleton.tsx
git commit -m "feat: add dashboard page with attendance stats and calendar heatmap"
```

---

## Task 13: Settings Page

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/SettingsClient.tsx`

- [ ] **Step 1: Create `app/settings/page.tsx`**

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Nav } from '@/components/Nav'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  return (
    <>
      <Nav />
      <SettingsClient />
    </>
  )
}
```

- [ ] **Step 2: Create `app/settings/SettingsClient.tsx`**

```typescript
'use client'
import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { UserSettings } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
]

export function SettingsClient() {
  const router = useRouter()
  const { data: settings, mutate } = useSWR<UserSettings>('/api/settings', fetcher)
  const [form, setForm] = useState<UserSettings | null>(null)
  const [locationText, setLocationText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings && !form) {
      setForm(settings)
      setLocationText(settings.locationText ?? '')
    }
  }, [settings, form])

  if (!form) {
    return (
      <main className="max-w-xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-slate-800 h-32 rounded-xl" />)}
        </div>
      </main>
    )
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)

    let lat = form.lat
    let lon = form.lon

    // Geocode if location text changed
    if (locationText !== form.locationText && locationText.trim()) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText)}&count=1`
      ).then(r => r.json())
      if (geo.results?.[0]) {
        lat = geo.results[0].latitude
        lon = geo.results[0].longitude
      }
    }

    const updated: UserSettings = { ...form, locationText, lat, lon }
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    await mutate()
    setSaving(false)
    router.push('/dashboard')
  }

  const inputClass = 'bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 w-44 focus:outline-none focus:border-blue-500'

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure your attendance tracking preferences. Saved to your account.</p>
      </div>

      {/* Attendance */}
      <SettingsCard title="Attendance">
        <FormRow label="Target attendance" hint="Percentage of working days to be in office per month">
          <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setForm(f => f ? { ...f, targetPct: Math.max(0.1, parseFloat((f.targetPct - 0.05).toFixed(2))) } : f)}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-lg"
            >−</button>
            <div className="w-14 text-center text-sky-400 font-bold text-base border-x border-slate-600 h-9 leading-9">
              {Math.round(form.targetPct * 100)}%
            </div>
            <button
              onClick={() => setForm(f => f ? { ...f, targetPct: Math.min(1, parseFloat((f.targetPct + 0.05).toFixed(2))) } : f)}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-lg"
            >+</button>
          </div>
        </FormRow>
        <FormRow label="Event keyword" hint="Calendar events containing this word count as office days">
          <input
            type="text"
            value={form.keyword}
            onChange={e => setForm(f => f ? { ...f, keyword: e.target.value } : f)}
            className={inputClass}
          />
        </FormRow>
      </SettingsCard>

      {/* Location */}
      <SettingsCard title="Location & Holidays">
        <FormRow label="Location" hint="City name used for weather forecast (e.g. Bangalore)">
          <input
            type="text"
            value={locationText}
            onChange={e => setLocationText(e.target.value)}
            placeholder="e.g. Bangalore"
            className={inputClass}
          />
        </FormRow>
        <FormRow label="Country" hint="Public holidays excluded from working day count">
          <select
            value={form.country}
            onChange={e => setForm(f => f ? { ...f, country: e.target.value } : f)}
            className={inputClass}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </FormRow>
      </SettingsCard>

      {/* Account */}
      <div className="bg-slate-800 border border-rose-900 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-rose-900 text-xs font-semibold text-rose-400 uppercase tracking-wider">Account</div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-100">Sign out</div>
            <div className="text-xs text-slate-400">You'll need to sign in again with Google</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="border border-rose-700 text-rose-400 text-sm px-4 py-2 rounded-lg hover:bg-rose-900/30 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </main>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {title}
      </div>
      <div className="divide-y divide-slate-700/50">{children}</div>
    </div>
  )
}

function FormRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{hint}</div>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

1. Sign in → navigate to `/settings`
2. Change target % with stepper — value updates in real time
3. Enter a city name (e.g. "Bangalore") in Location
4. Click "Save settings" — should geocode, save to KV, redirect to dashboard
5. Verify weather recommendations now appear on dashboard

- [ ] **Step 4: Commit**

```bash
git add app/settings
git commit -m "feat: add settings page with stepper, geocoding, and KV save"
```

---

## Task 14: Polish — Mobile, Empty States, Error Boundary

**Files:**
- Modify: `app/dashboard/DashboardClient.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add mobile responsive classes to DashboardClient**

In `app/dashboard/DashboardClient.tsx`, replace the top stats block:

```typescript
// Replace this:
<div className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">

// With this:
<div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800 rounded-xl p-4">
```

Replace the recommendation grid:

```typescript
// In RecommendationStrip.tsx, replace:
<div className="grid grid-cols-3 gap-3">

// With:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

Replace the StatGrid:

```typescript
// In StatGrid.tsx, the 2×2 grid is already responsive. Verify on mobile by
// resizing browser — each card should stack on small viewports.
```

- [ ] **Step 2: Handle SWR error states in DashboardClient**

In `app/dashboard/DashboardClient.tsx`, add error handling after the SWR hooks:

```typescript
const { data: settings, error: settingsErr } = useSWR<UserSettings>('/api/settings', fetcher)
const { data: holidays, error: holidaysErr } = useSWR<Holiday[]>(...)
const { data: events, error: eventsErr } = useSWR<CalendarEvent[]>(...)

// Add after all hooks, before the skeleton check:
if (settingsErr || holidaysErr || eventsErr) {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400">
        <p className="font-medium text-slate-200 mb-1">Something went wrong</p>
        <p className="text-sm">Try refreshing the page. If the problem persists, sign out and back in.</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Add "no events" hint in DashboardClient**

After computing `stats`, add the hint below the heatmap in the JSX:

```typescript
{stats.attendedCount === 0 && (
  <p className="text-xs text-slate-500 text-center -mt-2">
    No events matched keyword &quot;{settings.keyword}&quot;.{' '}
    <a href="/settings" className="text-sky-400 underline">Check your keyword in Settings.</a>
  </p>
)}
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest
```

Expected: All tests pass with no failures.

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: Compiled successfully with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add mobile responsive layout, error states, and empty state hints"
```

---

## Task 15: Deploy to Vercel

- [ ] **Step 1: Push repo to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/office-tracker.git
git push -u origin main
```

- [ ] **Step 2: Import project on Vercel**

Go to vercel.com → "Add New Project" → import your GitHub repo → Framework: Next.js (auto-detected).

- [ ] **Step 3: Add environment variables in Vercel dashboard**

Under Project Settings → Environment Variables, add:

```
GOOGLE_CLIENT_ID         = (from Google Cloud Console)
GOOGLE_CLIENT_SECRET     = (from Google Cloud Console)
NEXTAUTH_SECRET          = (output of: openssl rand -base64 32)
NEXTAUTH_URL             = https://your-app.vercel.app
```

- [ ] **Step 4: Link Vercel KV store**

In Vercel dashboard → Storage → Create Database → KV → link to this project. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

- [ ] **Step 5: Add production redirect URI in Google Cloud Console**

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
- Add to Authorised redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`

- [ ] **Step 6: Add test users**

In Google Cloud Console → APIs & Services → OAuth consent screen → Test users → add each user's Gmail address (up to 100).

- [ ] **Step 7: Verify production deployment**

Visit `https://your-app.vercel.app` → sign in → confirm dashboard loads with real calendar data.

- [ ] **Step 8: Final commit**

```bash
git tag v1.0.0
git push --tags
```

---

## Running All Tests

```bash
npx jest                  # run full suite
npx jest --watch          # watch mode during development
npx jest --coverage       # coverage report
```

Expected passing tests: attendance utilities (6), weather utilities (9), AttendanceDonut (3), StatGrid (3), CalendarHeatmap (3), RecommendationStrip (4), settings API (5) = **33 tests total**.

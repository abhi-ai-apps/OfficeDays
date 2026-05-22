# Office Days — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Supersedes:** `docs/ADR-001-office-attendance-tracker.md`

---

## Overview

A personal web app that reads Google Calendar to detect office days, computes attendance against a configurable target, and recommends upcoming days to go in based on weather. Single-user, no database, current month scope for v1.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Dashboard   │  │  Calendar    │  │  Settings Page    │  │
│  │  (stats,     │  │  Heatmap     │  │  (/settings)      │  │
│  │   progress)  │  │              │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         └─────────────────┴──────────────SWR────┘            │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetch
┌───────────────────────────▼─────────────────────────────────┐
│                  Next.js API Routes (server-side)            │
│                                                              │
│  /api/auth/[...nextauth]  — NextAuth.js (Google OAuth)      │
│  /api/calendar            — Google Calendar API v3           │
│  /api/holidays            — Nager.Date REST API              │
│  /api/weather             — Open-Meteo (no key required)     │
│  /api/settings            — Vercel KV (Upstash) read/write  │
└──────┬────────────────────┬────────────┬────────────────────┘
       │                    │            │
       ▼                    ▼            ▼
 Google Calendar      Open-Meteo    nager.date + Vercel KV
 API v3 (OAuth2)      (free, no key)   (Upstash Redis)
```

---

## Tech Stack

| Layer         | Choice                          | Notes |
|---------------|---------------------------------|-------|
| Framework     | Next.js 14 (App Router)         | TypeScript |
| Auth          | NextAuth.js + Google provider   | Handles OAuth2 + token refresh |
| Calendar      | `googleapis` npm package        | `calendar.events.list` |
| Weather       | Open-Meteo                      | Free, no API key, no rate limits |
| Holidays      | `nager.date` REST API           | Free, no key, 100+ countries |
| Settings      | Vercel KV (Upstash Redis)       | Per-user settings only |
| Caching       | Next.js `unstable_cache`        | Weather: 3h TTL, Holidays: 1 week TTL |
| UI            | Tailwind CSS + shadcn/ui        | |
| Charts        | Recharts                        | Donut chart, calendar heatmap |
| Data fetching | SWR                             | Client-side cache + revalidation |
| Deployment    | Vercel (hobby)                  | Free, auto-deploys from GitHub |

---

## User Flows

**Flow 1 — First-time visit**
```
Landing page (not signed in)
  → "Sign in with Google" button
  → Google OAuth consent (scope: calendar.readonly)
  → Redirect back → NextAuth creates session (httpOnly cookie)
  → Dashboard loads → GET /api/settings (key not found)
  → Default settings written to KV: { targetPct: 60, keyword: "office", country: "IN", lat: null, lon: null }
```

**Flow 2 — Returning visit**
```
App loads → NextAuth reads session cookie
  → Session valid → SWR fetches /api/calendar, /api/holidays, /api/weather in parallel
  → Settings fetched from /api/settings (KV lookup by Google sub ID)
  → Attendance computed client-side → Dashboard renders
```

**Flow 3 — Session expired**
```
SWR fetch returns 401
  → NextAuth attempts silent token refresh via refresh token
  → If refresh fails → redirect to sign-in page for full re-auth
```

**Flow 4 — Changing settings**
```
User navigates to /settings
  → Edits target %, keyword, country, location
  → "Save" → PATCH /api/settings → KV write (keyed by sub ID)
  → SWR revalidates /api/calendar if keyword changed
  → Redirect to dashboard
```

**Flow 5 — Viewing recommendations**
```
Dashboard loads
  → Client computes stillNeeded = targetCount - attendedCount
  → If stillNeeded > 0 and remaining working days exist:
      → Weather days scored by Open-Meteo forecast
      → Top N days shown as recommendation cards
  → If target already met: "You've hit your target!" empty state
```

**Flow 6 — No events found**
```
/api/calendar returns empty array
  → Dashboard shows 0% attended
  → Inline tip: "No events matched keyword 'office'. Check your keyword in Settings."
```

---

## Dashboard Layout (Layout B — Donut + Grid)

```
┌────────────────────────────────────────────────┐
│  OFFICE DAYS                       May 2026 ⚙  │
├──────────────┬─────────────────────────────────┤
│              │  Attended     │  Working days   │
│  SVG Donut   │  8 days       │  17 total       │
│  47% of 60%  ├───────────────┼─────────────────┤
│              │  Remaining    │  Still needed   │
│              │  9 days       │  3 more  [red]  │
├──────────────┴─────────────────────────────────┤
│  Calendar Heatmap — May 2026                   │
│  Mo Tu We Th Fr                                │
│  □  □  □  🟦 □   ← blue = office day           │
│  🟦 □  🟨 □  🟦  ← amber = holiday              │
│  □  🟦 □  □  [today border]                    │
│  Legend: 🟦 Office  🟨 Holiday  □ Today         │
├─────────────────────────────────────────────────┤
│  Recommended days (next 7 days)                │
│  ┌──────────┬──────────┬──────────┐            │
│  │ Tue 26   │ Thu 28   │ Fri 29   │            │
│  │ ☀️ 28°C  │ ⛅ 26°C  │ 🌧 24°C  │            │
│  │ Rain: 5% │Rain: 15% │Rain: 70% │            │
│  │ Go! ✅   │ Go! ✅   │ Maybe ⚠️ │            │
│  └──────────┴──────────┴──────────┘            │
└─────────────────────────────────────────────────┘
```

---

## Settings Page (/settings)

Separate route (not a drawer). Three card sections:

**Attendance**
- Target attendance — stepper in 5% increments (10%–100%), with progress bar
- Event keyword — text input; calendar events containing this word count as office days

**Location & Holidays**
- Location — text input (city, country); used for weather forecast geocoding
- Country — dropdown; drives public holiday exclusions via Nager.Date

**Account**
- Sign out button (danger style)

Save/Cancel actions at page bottom. Responsive: form rows stack vertically below 500px.

---

## Data Flow

### `/api/calendar`
```
GET /api/calendar?month=2026-05&keyword=office

1. Read Google sub from NextAuth session
2. Call googleapis calendar.events.list:
   { calendarId: 'primary', timeMin, timeMax, q: keyword }
   (keyword passed as query param — client reads settings via SWR first, then calls this route)
3. Return: [{ date, title }]
```

### `/api/holidays`
```
GET /api/holidays?country=IN&year=2026

1. Proxy to https://date.nager.at/api/v3/PublicHolidays/2026/IN
2. Cache 1 week via unstable_cache
3. Return: [{ date, localName }]
```

### `/api/weather`
```
GET /api/weather?lat=12.97&lon=77.59

1. If lat or lon is missing/null → return 400; dashboard hides the
   recommendations section and shows "Set your location in Settings."
2. Call https://api.open-meteo.com/v1/forecast
     ?latitude=12.97&longitude=77.59
     &daily=temperature_2m_max,precipitation_probability_max,weathercode
     &timezone=auto&forecast_days=7
3. Cache 3h via unstable_cache
4. Return: [{ date, tempMax, precipProbability, weatherCode }]
```

### `/api/settings`
```
GET  /api/settings  → kv.get(`settings:${sub}`)
PATCH /api/settings → kv.set(`settings:${sub}`, body)

Default on first login (key not found):
{ targetPct: 60, keyword: "office", country: "IN", lat: null, lon: null }
```

### Attendance calculation (client-side)
```ts
const workingDays = getWeekdays(month).filter(d => !isHoliday(d))
const attended    = calendarEvents.map(e => e.date)
const attendedCount = attended.filter(d => workingDays.includes(d)).length
const attendancePct = attendedCount / workingDays.length

const targetCount   = Math.ceil(targetPct * workingDays.length)
const stillNeeded   = Math.max(0, targetCount - attendedCount)
const remaining     = workingDays.filter(d => d > today)
```

### Weather scoring (client-side)
```ts
function weatherScore({ precipProbability, tempMax, weatherCode }) {
  let score = 100
  score -= precipProbability * 60   // heavy penalty for rain
  if (tempMax > 38) score -= 20     // penalty for extreme heat
  if (weatherCode >= 80) score -= 40 // WMO code: showers/storm
  return score
}

const recommendations = remaining
  .filter(d => weatherForecast[d])
  .map(d => ({ date: d, score: weatherScore(weatherForecast[d]) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, stillNeeded)
```

---

## Environment Variables (Vercel)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...              # openssl rand -base64 32
NEXTAUTH_URL=https://your-app.vercel.app

# Vercel KV (Upstash) — auto-injected when KV store is linked in Vercel dashboard
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

No `OPENWEATHERMAP_API_KEY` — Open-Meteo requires no key.  
No `NEXT_PUBLIC_DEFAULT_COUNTRY` — country is a per-user KV setting.

---

## Implementation Phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 — Core | Next.js scaffold, NextAuth + Google OAuth (`calendar.readonly`), `/api/calendar`, `/api/holidays`, `/api/settings` + KV | 1–2 days |
| 2 — Dashboard UI | Donut chart, 2×2 stat grid, calendar heatmap with legend | 1 day |
| 3 — Weather + Recs | `/api/weather` (Open-Meteo), scoring function, forecast strip UI | 1 day |
| 4 — Settings page | `/settings` route, stepper, form, PATCH to KV, redirect | 0.5 day |
| 5 — Polish | Mobile responsive, loading skeletons, error boundaries, empty states | 0.5 day |

---

## Trade-off Notes

| Concern | Decision |
|---------|----------|
| Settings persistence without DB | Vercel KV (Upstash) — settings only; API responses cached via `unstable_cache` |
| Event detection | Keyword search (user-configurable, stored in KV). Fragile to typos but simplest to set up. |
| Weather API | Open-Meteo — fully free, no key, WMO weather codes map cleanly to icons and scoring |
| Month scope | Current month only for v1. Multi-month navigation deferred. |
| No DB | Google Calendar is source of truth. Attendance is derived, not stored. |
| Multi-user | Sub-ID keying in KV makes this non-breaking if needed later. Not a current goal. |

---

## Consequences

**Becomes easier:**
- No backend infra, no DB migrations
- Google OAuth handles identity
- Vercel auto-deploys on every `git push`
- Open-Meteo removes API key management entirely

**Becomes harder:**
- Historical analytics beyond Google Calendar requires a DB (Supabase is the natural next step)
- Team-level tracking requires multi-tenant auth + DB

**Revisit if:**
- Multi-user / team rollout → add Supabase
- Slack reminders → add Vercel cron job + Slack webhook
- Multi-month view → Phase 6: add month navigation to dashboard

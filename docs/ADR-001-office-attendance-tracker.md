# ADR-001: Office Attendance Tracker — Web App Architecture

**Status:** Proposed  
**Date:** 2026-05-22  
**Deciders:** Abhijit  

---

## Context

Need a personal web app that:
1. Reads Google Calendar to detect "office day" events
2. Knows about public holidays to compute true working days
3. Shows an attendance dashboard (days attended, %, target)
4. Integrates a weather forecast API
5. Recommends which upcoming days to go in to hit a target attendance % by month-end

Constraints: personal/solo use, minimal infra cost, fast to ship, TypeScript stack.

---

## Options Considered

### Option A: Pure Client-Side SPA (React + Vite)

| Dimension        | Assessment |
|-----------------|------------|
| Complexity      | Low        |
| Cost            | Free (GitHub Pages / Netlify) |
| Scalability     | N/A (personal tool) |
| Team familiarity | High      |
| Security        | Poor — API keys exposed in browser |

**Pros:** Zero backend, instant deploy, no server maintenance.  
**Cons:** Weather API key exposed in client bundle; Google OAuth PKCE works but token handling is messier without a server; no server-side caching.

---

### Option B: Next.js (App Router) on Vercel ✅ Recommended

| Dimension        | Assessment |
|-----------------|------------|
| Complexity      | Low–Med    |
| Cost            | Free (Vercel hobby tier) |
| Scalability     | N/A (personal tool) |
| Team familiarity | High (React/TS) |
| Security        | Good — secrets stay server-side |

**Pros:** API keys never reach the browser; NextAuth.js handles Google OAuth + token refresh cleanly; API routes serve as a thin proxy for Calendar and Weather APIs; Vercel edge caching reduces redundant API calls; no separate backend to maintain.  
**Cons:** Slightly more boilerplate than a pure SPA; requires a Vercel account.

---

### Option C: React + Node/Express + PostgreSQL

| Dimension        | Assessment |
|-----------------|------------|
| Complexity      | High       |
| Cost            | ~$7–20/month (DB + hosting) |
| Scalability     | High       |
| Team familiarity | High      |
| Security        | Good       |

**Pros:** Full persistence, multi-user ready, historical analytics.  
**Cons:** Massive overkill for a personal tool; adds DB ops, migrations, and hosting complexity. Revisit if this becomes a team product.

---

## Decision

**Option B — Next.js 14 (App Router) on Vercel.**

No database required; Google Calendar is the source of truth. All secrets stay in Vercel environment variables. Fast to ship, zero ongoing cost.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Dashboard   │  │  Calendar    │  │  Settings     │  │
│  │  (stats,     │  │  Heatmap     │  │  (target %,   │  │
│  │   progress)  │  │              │  │   keyword,    │  │
│  └──────┬───────┘  └──────┬───────┘  │   location)   │  │
│         └─────────────────┴──────────└───────┬───────┘  │
│                            │                 │           │
│                    React Query / SWR          │           │
└───────────────────────────┬──────────────────┼───────────┘
                            │ fetch            │ fetch
┌───────────────────────────▼──────────────────▼───────────┐
│                  Next.js API Routes (server-side)         │
│                                                          │
│  /api/auth/[...nextauth]  — NextAuth.js (Google OAuth)   │
│  /api/calendar            — Google Calendar API v3       │
│  /api/weather             — OpenWeatherMap API           │
│  /api/holidays            — Nager.Date public API        │
└──────┬────────────────────┬────────────────┬─────────────┘
       │                    │                │
       ▼                    ▼                ▼
 Google Calendar      OpenWeatherMap    nager.date/api
 API v3 (OAuth2)      (free tier,       (free, no key,
                       7-day forecast)   country holidays)
```

---

## Tech Stack

| Layer            | Choice                          | Notes |
|------------------|---------------------------------|-------|
| Framework        | Next.js 14 (App Router)         | TypeScript |
| Auth             | NextAuth.js + Google provider   | Handles OAuth2 + token refresh |
| Calendar         | `googleapis` npm package        | `calendar.events.list` |
| Weather          | OpenWeatherMap Forecast API     | Free: 1000 calls/day, 5-day/3h or One Call API |
| Holidays         | `nager.date` REST API           | Free, no key, supports 100+ countries |
| UI               | Tailwind CSS + shadcn/ui        | |
| Charts           | Recharts or Chart.js            | Attendance ring, calendar heatmap |
| Data fetching    | SWR or React Query              | Client-side cache + revalidation |
| Deployment       | Vercel (hobby)                  | Free, auto-deploys from GitHub |

---

## Data Flow

### 1. Authentication
- User lands on app → NextAuth redirects to Google OAuth consent
- Scopes requested: `calendar.readonly`
- Access + refresh tokens stored in encrypted NextAuth session (httpOnly cookie)

### 2. Calendar Event Fetch (`/api/calendar`)
```
GET /api/calendar?month=2026-05

Server:
  1. Read session token (NextAuth)
  2. Call Google Calendar API:
     calendar.events.list({
       calendarId: 'primary',
       timeMin: start of month,
       timeMax: end of month,
       q: <user's keyword, e.g. "office">   // OR filter by event color/label
     })
  3. Return filtered events: [{ date, title }]
```

### 3. Holiday Fetch (`/api/holidays`)
```
GET /api/holidays?country=IN&year=2026

Server:
  1. Proxy to https://date.nager.at/api/v3/PublicHolidays/2026/IN
  2. Cache response (revalidate weekly — holidays don't change)
  3. Return: [{ date, localName }]
```

### 4. Attendance Calculation (client-side)
```ts
const workingDays = getWeekdays(month).filter(d => !isHoliday(d))
const attended    = calendarEvents.map(e => e.date)
const attendedCount   = attended.filter(d => workingDays.includes(d)).length
const attendancePct   = attendedCount / workingDays.length

const remaining       = workingDays.filter(d => d > today)
const targetCount     = Math.ceil(targetPct * workingDays.length)
const stillNeeded     = Math.max(0, targetCount - attendedCount)
```

### 5. Weather Fetch (`/api/weather`)
```
GET /api/weather?lat=...&lon=...

Server:
  1. Call OpenWeatherMap One Call API (or 5-day forecast)
  2. For each upcoming working day (up to 7 days), extract:
     { date, tempMax, precipProbability, description, icon }
  3. Cache 3 hours (weather doesn't need per-request freshness)
```

### 6. Smart Day Recommendation (client-side)
```ts
// Score each remaining working day (within forecast window)
const scored = remainingDays
  .filter(d => weatherForecast[d])
  .map(d => ({
    date: d,
    score: weatherScore(weatherForecast[d])  // high temp ✓, low rain ✓
  }))
  .sort((a, b) => b.score - a.score)

const recommendations = scored.slice(0, stillNeeded)
```

Weather scoring function (tunable):
```ts
function weatherScore({ precipProbability, tempMax, description }) {
  let score = 100
  score -= precipProbability * 60   // heavy penalty for rain
  if (tempMax > 38) score -= 20     // penalty for extreme heat
  if (description.includes('storm')) score -= 40
  return score
}
```

---

## Dashboard Components

```
┌────────────────────────────────────────────────┐
│  🏢 Office Attendance Tracker        May 2026  │
├──────────────────┬─────────────────────────────┤
│                  │  Target: 60%                │
│   Donut Chart    │  Attended: 8 days (47%)     │
│   47% / 60%      │  Working days: 17           │
│                  │  Remaining: 9 days          │
│                  │  Still needed: 3 more days  │
├──────────────────┴─────────────────────────────┤
│  Calendar Heatmap — May 2026                   │
│  [Mo][Tu][We][Th][Fr]                          │
│  [  ][  ][🏢][  ][🏢]  ← office days green    │
│  [🎉][  ][🏢][  ][  ]  ← holidays orange      │
│  [  ][⭐][  ][⭐][  ]  ← recommended days star │
├─────────────────────────────────────────────────┤
│  📅 Recommended Days (next 7 days)             │
│  ┌──────────┬──────────┬──────────┐            │
│  │ Tue 26   │ Thu 28   │ Fri 29   │            │
│  │ ☀️ 28°C  │ ⛅ 26°C  │ 🌧 24°C  │            │
│  │ Rain: 5% │Rain: 15% │Rain: 70% │            │
│  │ ✅ Go!   │ ✅ Go!   │ ⚠️ Maybe │            │
│  └──────────┴──────────┴──────────┘            │
└─────────────────────────────────────────────────┘
```

---

## Environment Variables (Vercel)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...                    # openssl rand -base64 32
NEXTAUTH_URL=https://your-app.vercel.app
OPENWEATHERMAP_API_KEY=...
NEXT_PUBLIC_DEFAULT_COUNTRY=IN        # for holiday API
```

---

## Implementation Phases

### Phase 1 — Core (1–2 days)
- [ ] Next.js project scaffold with TypeScript + Tailwind
- [ ] NextAuth.js with Google provider + `calendar.readonly` scope
- [ ] `/api/calendar` route — fetch and filter events by keyword
- [ ] `/api/holidays` route — fetch public holidays for country
- [ ] Basic attendance stats: working days, attended, %

### Phase 2 — Dashboard UI (1 day)
- [ ] Donut/ring chart for attendance %
- [ ] Calendar heatmap (office days, holidays, today)
- [ ] Settings panel: target %, event keyword, location, country

### Phase 3 — Weather + Recommendations (1 day)
- [ ] `/api/weather` route — OpenWeatherMap integration
- [ ] Weather score function + recommendation engine
- [ ] Forecast strip UI with recommended day highlights

### Phase 4 — Polish
- [ ] Mobile responsive layout
- [ ] Multi-month view / year summary
- [ ] Export to CSV
- [ ] Optional: push to Notion via Cowork connector

---

## Trade-off Analysis

| Concern | Decision |
|---------|----------|
| No DB | Calendar = source of truth. Attendance is derived, not stored. Stateless is fine for personal use. |
| Google API quota | Calendar API: 1M requests/day free. Not a concern. |
| Weather API quota | OpenWeatherMap free tier: 1000 calls/day. With 3h cache: well within limits. |
| Holiday coverage | Nager.Date covers 100+ countries. Edge case: some regional/state holidays missing — allow manual override in settings. |
| Keyword matching | User tags events with a keyword (e.g., "office"). Alternative: dedicate a secondary Google Calendar just for office days (cleaner, use `calendarId` instead of keyword search). |

---

## Consequences

**Becomes easier:**
- No backend infra to maintain
- Google OAuth handles identity — no user table needed
- Vercel auto-deploys on every `git push`

**Becomes harder:**
- Multi-user / team rollout would require adding a DB (Supabase is the natural next step)
- Historical analytics beyond what's in Google Calendar needs local storage or DB

**Revisit if:**
- You want team-level attendance tracking → add Supabase + multi-tenant auth
- You want Slack notifications for reminders → add a Vercel cron job + Slack webhook

---

## Action Items

1. [ ] Create Next.js project: `npx create-next-app@latest office-tracker --typescript --tailwind --app`
2. [ ] Set up Google Cloud project → enable Calendar API → create OAuth2 credentials
3. [ ] Get free OpenWeatherMap API key at openweathermap.org
4. [ ] Install deps: `next-auth googleapis swr recharts`
5. [ ] Deploy to Vercel, add env vars, share URL

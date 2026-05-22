'use client'
import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { UserSettings } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
})

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
  const [saveError, setSaveError] = useState<string | null>(null)

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
    setSaveError(null)
    try {
      let lat = form.lat
      let lon = form.lon

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
      router.push('/dashboard')
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 w-44 focus:outline-none focus:border-blue-500'

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure your attendance tracking preferences. Saved to your account.</p>
      </div>

      <SettingsCard title="Attendance">
        <FormRow label="Target attendance" hint="Percentage of working days to be in office per month">
          <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setForm(f => f ? { ...f, targetPct: Math.max(0.1, parseFloat((f.targetPct - 0.05).toFixed(2))) } : f)}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-lg"
              aria-label="Decrease target"
            >−</button>
            <div className="w-14 text-center text-sky-400 font-bold text-base border-x border-slate-600 h-9 leading-9">
              {Math.round(form.targetPct * 100)}%
            </div>
            <button
              type="button"
              onClick={() => setForm(f => f ? { ...f, targetPct: Math.min(1, parseFloat((f.targetPct + 0.05).toFixed(2))) } : f)}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-lg"
              aria-label="Increase target"
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

      <div className="bg-slate-800 border border-rose-900 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-rose-900 text-xs font-semibold text-rose-400 uppercase tracking-wider">Account</div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-100">Sign out</div>
            <div className="text-xs text-slate-400">You'll need to sign in again with Google</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="border border-rose-700 text-rose-400 text-sm px-4 py-2 rounded-lg hover:bg-rose-900/30 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {saveError && (
        <p className="text-sm text-rose-400 text-right">{saveError}</p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
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

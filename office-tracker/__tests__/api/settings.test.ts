/**
 * @jest-environment node
 */
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

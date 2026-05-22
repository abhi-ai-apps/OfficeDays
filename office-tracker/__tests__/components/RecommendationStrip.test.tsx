import { render, screen } from '@testing-library/react'
import { RecommendationStrip } from '@/components/RecommendationStrip'
import { Recommendation } from '@/lib/types'

const rec: Recommendation = {
  date: '2026-05-26',
  score: 95,
  tempMax: 28,
  precipProbability: 5,
  weatherCode: 0,
  recommended: true,
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

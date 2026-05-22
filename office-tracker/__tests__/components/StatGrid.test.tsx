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

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

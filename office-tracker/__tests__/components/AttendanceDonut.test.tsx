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

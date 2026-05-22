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
      <p className={`text-xs mb-0.5 ${highlight ? 'text-rose-200' : 'text-slate-400'}`}>
        {label}
      </p>
      <div className={`text-lg font-bold ${highlight ? 'text-white' : 'text-slate-100'}`}>
        {value}{' '}
        <span className={`text-xs font-normal ${highlight ? 'text-rose-200' : 'text-slate-500'}`}>{unit}</span>
      </div>
    </div>
  )
}

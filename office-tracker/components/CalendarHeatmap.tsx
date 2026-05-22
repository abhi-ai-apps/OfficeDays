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
              'h-8 rounded flex items-center justify-center',
              day ? cellBg(day) : '',
              day && toISO(day) === today ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : '',
            ].join(' ')}
          >
            {day && (
              <span className={`text-[10px] font-medium select-none ${
                attendedSet.has(toISO(day)) ? 'text-white' :
                holidaySet.has(toISO(day)) ? 'text-amber-100' :
                'text-slate-400'
              }`}>
                {day}
              </span>
            )}
          </div>
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

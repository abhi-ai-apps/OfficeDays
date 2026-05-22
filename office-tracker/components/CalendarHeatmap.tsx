interface Props {
  year: number
  month: number
  workingDays: string[]
  attended: string[]
  holidays: string[]
  companyHolidays?: string[]
  today: string
  onToggleCompanyHoliday?: (date: string) => void
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function CalendarHeatmap({ year, month, workingDays, attended, holidays, companyHolidays = [], today, onToggleCompanyHoliday }: Props) {
  const attendedSet = new Set(attended)
  const holidaySet = new Set(holidays)
  const companyHolidaySet = new Set(companyHolidays)
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
    if (companyHolidaySet.has(iso)) return 'bg-violet-500 opacity-80'
    const dow = new Date(iso + 'T12:00:00').getDay()
    if (dow === 0 || dow === 6) return 'bg-slate-900'
    return 'bg-slate-700'
  }

  const isClickable = (day: number) => {
    const iso = toISO(day)
    if (holidaySet.has(iso)) return false        // can't override public holidays
    if (attendedSet.has(iso)) return false        // already attended
    const dow = new Date(iso + 'T12:00:00').getDay()
    return dow !== 0 && dow !== 6                 // only weekdays
  }

  const textColor = (day: number) => {
    const iso = toISO(day)
    if (attendedSet.has(iso)) return 'text-white'
    if (holidaySet.has(iso)) return 'text-amber-100'
    if (companyHolidaySet.has(iso)) return 'text-violet-100'
    return 'text-slate-400'
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
        {cells.map((day, i) => {
          const clickable = day ? isClickable(day) : false
          const iso = day ? toISO(day) : ''
          const isCompanyHol = companyHolidaySet.has(iso)
          const tooltipText = clickable
            ? (isCompanyHol ? 'Remove company holiday' : 'Add company holiday')
            : null

          return (
            <div
              key={i}
              onClick={() => clickable && onToggleCompanyHoliday?.(iso)}
              className={[
                'relative group h-8 rounded flex items-center justify-center transition-opacity',
                day ? cellBg(day) : '',
                day && toISO(day) === today ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : '',
                clickable ? 'cursor-pointer hover:opacity-80' : '',
              ].join(' ')}
            >
              {day && (
                <span className={`text-[10px] font-medium select-none ${textColor(day)}`}>
                  {day}
                </span>
              )}
              {tooltipText && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 hidden group-hover:block">
                  <div className="bg-slate-900 text-slate-100 text-[10px] font-medium whitespace-nowrap rounded px-2 py-1 shadow-lg border border-slate-700">
                    {tooltipText}
                  </div>
                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 mx-auto -mt-1" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <LegendItem color="bg-sky-500" label="Office" />
        <LegendItem color="bg-amber-500 opacity-60" label="Public holiday" />
        <LegendItem color="bg-violet-500 opacity-80" label="Company holiday" />
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-sky-400" />
          <span className="text-[10px] text-slate-500">Today</span>
        </div>
      </div>
      {onToggleCompanyHoliday && (
        <p className="text-[10px] text-slate-600 mt-2">Click any weekday to mark/unmark as company holiday</p>
      )}
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

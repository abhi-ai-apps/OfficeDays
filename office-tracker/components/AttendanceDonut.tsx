interface Props {
  attendancePct: number   // 0 to 1+
  targetPct: number       // 0 to 1
}

const R = 22
const C = 2 * Math.PI * R  // ≈ 138.23

export function AttendanceDonut({ attendancePct, targetPct }: Props) {
  const fillOffset = C * (1 - Math.min(attendancePct, 1))

  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90 w-full h-full">
        <circle cx="30" cy="30" r={R} fill="none" stroke="#334155" strokeWidth="8" />
        <circle
          cx="30" cy="30" r={R}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="8"
          strokeDasharray={C}
          strokeDashoffset={fillOffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        <circle
          cx="30" cy="30" r={R}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray={`2 ${C - 2}`}
          strokeDashoffset={C * (1 - targetPct)}
        />
      </svg>
      <div className="z-10 text-center">
        <div className="text-sky-400 text-base font-bold leading-none">
          {Math.round(attendancePct * 100)}%
        </div>
        <div className="text-slate-500 text-[10px] mt-0.5">
          of {Math.round(targetPct * 100)}%
        </div>
      </div>
    </div>
  )
}

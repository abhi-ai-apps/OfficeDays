export function DashboardSkeleton() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">
        <div className="w-24 h-24 rounded-full bg-slate-700 flex-shrink-0" />
        <div className="grid grid-cols-2 gap-2 flex-1">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-700 rounded-lg h-16" />)}
        </div>
      </div>
      <div className="bg-slate-800 rounded-xl h-52" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl h-28" />)}
      </div>
    </main>
  )
}

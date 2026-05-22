'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav() {
  const pathname = usePathname()
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm px-4 py-1.5 rounded-md transition-colors ${
        pathname === href
          ? 'bg-blue-700 text-white'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 h-14 flex items-center justify-between">
      <span className="text-sm font-bold tracking-widest text-slate-100">OFFICE DAYS</span>
      <div className="flex gap-1">
        {link('/dashboard', 'Dashboard')}
        {link('/settings', 'Settings')}
      </div>
    </nav>
  )
}

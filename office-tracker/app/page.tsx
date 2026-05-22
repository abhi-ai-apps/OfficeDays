import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { SignInButton } from '@/components/SignInButton'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-100">Office Days</h1>
        <p className="text-slate-400">Track your office attendance against your monthly target.</p>
        <SignInButton />
      </div>
    </main>
  )
}

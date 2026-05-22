'use client'
import { signIn } from 'next-auth/react'

export function SignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
    >
      Sign in with Google
    </button>
  )
}

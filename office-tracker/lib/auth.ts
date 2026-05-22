import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

async function refreshAccessToken(token: { refreshToken?: string }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken ?? '',
    }),
  })
  const refreshed = await res.json()
  if (!res.ok) throw refreshed
  return {
    accessToken: refreshed.access_token as string,
    refreshToken: (refreshed.refresh_token ?? token.refreshToken) as string,
    accessTokenExpires: Date.now() + (refreshed.expires_in as number) * 1000,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (account.expires_in as number) * 1000,
        }
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token
      }
      try {
        const refreshed = await refreshAccessToken(token)
        return { ...token, ...refreshed }
      } catch {
        return { ...token, error: 'RefreshAccessTokenError' }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.sub = token.sub as string
      if (token.error) session.error = token.error as string
      return session
    },
  },
}

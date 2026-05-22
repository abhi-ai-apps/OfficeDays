import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    sub: string
    error?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}

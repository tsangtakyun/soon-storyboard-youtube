import { cookies } from 'next/headers'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export class GoogleOAuthConfigError extends Error {
  status = 503

  constructor(message: string) {
    super(message)
    this.name = 'GoogleOAuthConfigError'
  }
}

export class GoogleOAuthAuthError extends Error {
  status = 401

  constructor(message = 'NOT_AUTHENTICATED') {
    super(message)
    this.name = 'GoogleOAuthAuthError'
  }
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleOAuthConfigError('Google OAuth env not configured')
  }

  return { clientId, clientSecret, redirectUri }
}

export function encodeReturnTo(returnTo: string): string {
  return Buffer.from(returnTo).toString('base64url')
}

export function decodeReturnTo(state: string | null): string {
  if (!state) return '/'

  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8')
    return decoded.startsWith('/') ? decoded : '/'
  } catch {
    return '/'
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = cookies()
  const refreshToken = cookieStore.get('google_refresh_token')?.value
  if (!refreshToken) return null

  const { clientId, clientSecret } = getGoogleOAuthConfig()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) return null

  return data.access_token as string
}

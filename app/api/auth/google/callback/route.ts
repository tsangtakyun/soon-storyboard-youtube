import { NextResponse } from 'next/server'

import { decodeReturnTo, getGoogleOAuthConfig } from '@/lib/google-oauth'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const returnTo = decodeReturnTo(state)

  if (oauthError) {
    return NextResponse.redirect(
      `${url.origin}${returnTo}?drive_oauth_error=${encodeURIComponent(oauthError)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${url.origin}${returnTo}?drive_oauth_error=missing_code`)
  }

  try {
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig()
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || !tokens?.refresh_token) {
      return NextResponse.redirect(
        `${url.origin}${returnTo}?drive_oauth_error=no_refresh_token`
      )
    }

    const response = NextResponse.redirect(`${url.origin}${returnTo}`)
    response.cookies.set('google_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
    })

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google OAuth callback failed'
    return NextResponse.redirect(
      `${url.origin}${returnTo}?drive_oauth_error=${encodeURIComponent(message)}`
    )
  }
}

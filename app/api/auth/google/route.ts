import { NextResponse } from 'next/server'

import { encodeReturnTo, getGoogleOAuthConfig } from '@/lib/google-oauth'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const returnTo = url.searchParams.get('returnTo') ?? '/'
    const { clientId, redirectUri } = getGoogleOAuthConfig()

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: encodeReturnTo(returnTo),
    })

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Google OAuth not configured',
      },
      { status: 503 }
    )
  }
}

import { NextResponse } from 'next/server'

import { exportStoryboardToDrive } from '@/lib/drive-export'
import {
  GoogleOAuthAuthError,
  GoogleOAuthConfigError,
} from '@/lib/google-oauth'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await exportStoryboardToDrive(params.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof GoogleOAuthAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, needsAuth: true },
        { status: 401 }
      )
    }

    if (error instanceof GoogleOAuthConfigError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    console.error('[export-drive] failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Drive export failed',
      },
      { status: 500 }
    )
  }
}

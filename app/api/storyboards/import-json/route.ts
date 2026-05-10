import { NextResponse } from 'next/server'

import { importStoryboardFromJSON } from '@/lib/storyboard-import'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await importStoryboardFromJSON(body)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      },
      { status: 400 }
    )
  }
}

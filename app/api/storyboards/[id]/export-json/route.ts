import { NextResponse } from 'next/server'

import { exportStoryboardAsJSON } from '@/lib/storyboard-export'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const json = await exportStoryboardAsJSON(params.id)
    return NextResponse.json(json, {
      headers: {
        'Content-Disposition': `attachment; filename="storyboard-${params.id}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 }
    )
  }
}

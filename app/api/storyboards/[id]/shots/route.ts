import { NextResponse } from 'next/server'

import { createShot, listShots } from '@/lib/storyboard-actions'
import type {
  FootageSourceSlug,
  ScriptPartRole,
  VisualModeSlug,
} from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const shots = await listShots(params.id)
    return NextResponse.json({ success: true, shots })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '載入 shots 失敗',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as {
      scriptPartRole?: ScriptPartRole
      script_part_role?: ScriptPartRole
      visualModeSlug?: VisualModeSlug
      visual_mode_slug?: VisualModeSlug
      footageSourceSlug?: FootageSourceSlug
      footage_source_slug?: FootageSourceSlug
      description?: string
      durationSeconds?: number | null
    }

    const shot = await createShot({
      storyboardId: params.id,
      scriptPartRole: body.scriptPartRole ?? body.script_part_role ?? 'hook',
      visualModeSlug: body.visualModeSlug ?? body.visual_mode_slug,
      footageSourceSlug: body.footageSourceSlug ?? body.footage_source_slug,
      description: body.description,
      durationSeconds: body.durationSeconds,
    })

    return NextResponse.json({ success: true, shot })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '新增 shot 失敗',
      },
      { status: 500 }
    )
  }
}

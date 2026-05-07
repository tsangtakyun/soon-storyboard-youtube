import { NextResponse } from 'next/server'

import { generateAIStoryboard } from '@/lib/ai-storyboard-generator'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fetchScriptByStoryboard, mapShotRow } from '@/lib/storyboard-fetch'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: '未設定 ANTHROPIC_API_KEY' },
      { status: 503 }
    )
  }

  const supabase = getSupabaseServer()
  const { count, error: countError } = await supabase
    .from('storyboard_shots')
    .select('id', { count: 'exact', head: true })
    .eq('storyboard_id', params.id)

  if (countError) {
    return NextResponse.json(
      { success: false, error: countError.message },
      { status: 500 }
    )
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { success: false, error: 'Storyboard 已有 shots。要重新生成請先刪除現有 shots。' },
      { status: 400 }
    )
  }

  const script = await fetchScriptByStoryboard(params.id)
  if (!script) {
    return NextResponse.json(
      { success: false, error: '找不到對應 script' },
      { status: 404 }
    )
  }

  try {
    const generatedShots = await generateAIStoryboard(script)
    const { data, error } = await supabase
      .from('storyboard_shots')
      .insert(
        generatedShots.map((shot, index) => ({
          storyboard_id: params.id,
          script_part_role: shot.scriptPartRole,
          display_order: index,
          part_order: shot.partOrder,
          script_excerpt: shot.scriptExcerpt,
          visual_instruction: shot.visualInstruction,
          description: shot.scriptExcerpt,
          content_type_slug: shot.contentTypeSlug,
          visual_mode_slug: shot.visualModeSlug,
          footage_source_slug: shot.footageSourceSlug,
          duration_seconds: shot.durationSeconds,
          notes: shot.notes ?? null,
        }))
      )
      .select('*')

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      shots: (data ?? []).map(mapShotRow),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI generation failed',
      },
      { status: 500 }
    )
  }
}

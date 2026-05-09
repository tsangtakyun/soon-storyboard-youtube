import { NextResponse } from 'next/server'

import {
  generateAIStoryboardForPart,
  ScriptCoverageError,
} from '@/lib/ai-storyboard-generator'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fetchScriptByStoryboard, mapShotRow } from '@/lib/storyboard-fetch'
import type { ScriptPartRole } from '@/lib/types'

const VALID_PART_ROLES: ScriptPartRole[] = [
  'hook',
  'setup',
  'detail',
  'complication',
  'depth',
  'resolution',
]

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: '未設定 ANTHROPIC_API_KEY' },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    scriptPartRole?: ScriptPartRole
  } | null
  const partRole = body?.scriptPartRole

  if (!partRole || !VALID_PART_ROLES.includes(partRole)) {
    return NextResponse.json(
      { success: false, error: 'Invalid scriptPartRole' },
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

  if (!script.parts.some((part) => part.role === partRole)) {
    return NextResponse.json(
      { success: false, error: `Script does not contain part "${partRole}"` },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  try {
    const { error: deleteError } = await supabase
      .from('storyboard_shots')
      .delete()
      .eq('storyboard_id', params.id)
      .eq('script_part_role', partRole)

    if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`)

    const generatedShots = await generateAIStoryboardForPart(script, partRole)

    const { data: maxRow } = await supabase
      .from('storyboard_shots')
      .select('display_order')
      .eq('storyboard_id', params.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const baseOrder = (maxRow?.display_order ?? -1) + 1
    const { data, error } = await supabase
      .from('storyboard_shots')
      .insert(
        generatedShots.map((shot, index) => ({
          storyboard_id: params.id,
          script_part_role: shot.scriptPartRole,
          display_order: baseOrder + index,
          part_order: index,
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
      partRole,
      count: data?.length ?? 0,
      shots: (data ?? []).map(mapShotRow),
    })
  } catch (error) {
    if (error instanceof ScriptCoverageError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          coverage: {
            forwardRatio: error.details.forwardRatio,
            reverseRatio: error.details.reverseRatio,
            totalSentences: error.details.totalSentences,
            totalShots: error.details.totalShots,
            missingSentences: error.details.missingSentences,
            hallucinatedShots: error.details.hallucinatedShots,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 500 }
    )
  }
}

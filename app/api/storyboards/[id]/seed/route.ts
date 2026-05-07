import { NextResponse } from 'next/server'

import { generateDefaultShots } from '@/lib/default-shot-generator'
import { getSupabaseServer } from '@/lib/supabase-server'
import { fetchScriptByStoryboard, mapShotRow } from '@/lib/storyboard-fetch'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
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
      { success: false, error: 'Storyboard 已經有 shots，不能重新 seed' },
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

  const defaultShots = await generateDefaultShots(script)
  if (defaultShots.length === 0) {
    return NextResponse.json(
      { success: false, error: '呢個 script 未有可支援嘅 part role' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('storyboard_shots')
    .insert(
      defaultShots.map((shot) => ({
        storyboard_id: params.id,
        script_part_role: shot.scriptPartRole,
        display_order: shot.displayOrder,
        part_order: shot.partOrder,
        description: shot.description,
        visual_mode_slug: shot.visualModeSlug,
        footage_source_slug: shot.footageSourceSlug,
        duration_seconds: shot.durationSeconds,
        generation_status: shot.generationStatus ?? 'pending',
      }))
    )
    .select('*')

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    shots: (data ?? []).map(mapShotRow),
  })
}

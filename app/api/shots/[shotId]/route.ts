import { NextResponse } from 'next/server'

import { mapShotUpdate } from '@/lib/storyboard-actions'
import { getSupabaseServer } from '@/lib/supabase-server'
import { mapShotRow } from '@/lib/storyboard-fetch'

export async function PATCH(
  request: Request,
  { params }: { params: { shotId: string } }
) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const update = mapShotUpdate(body)

    if (update.footage_source_slug === 'synthetic_host') {
      return NextResponse.json(
        { success: false, error: '主持 AI 重建暫未啟用' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('storyboard_shots')
      .update(update)
      .eq('id', params.shotId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, shot: mapShotRow(data) })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新 shot 失敗',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { shotId: string } }
) {
  const supabase = getSupabaseServer()
  const { error } = await supabase
    .from('storyboard_shots')
    .delete()
    .eq('id', params.shotId)

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

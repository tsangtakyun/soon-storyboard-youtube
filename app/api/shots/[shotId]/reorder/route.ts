import { NextResponse } from 'next/server'

import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(
  request: Request,
  { params }: { params: { shotId: string } }
) {
  const { direction } = (await request.json()) as { direction: 'up' | 'down' }
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json(
      { success: false, error: 'Invalid direction' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { data: currentShot, error: currentError } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('id', params.shotId)
    .single()

  if (currentError || !currentShot) {
    return NextResponse.json(
      { success: false, error: currentError?.message ?? 'Shot not found' },
      { status: 404 }
    )
  }

  const siblingQuery = supabase
    .from('storyboard_shots')
    .select('*')
    .eq('storyboard_id', currentShot.storyboard_id)
    .eq('script_part_role', currentShot.script_part_role)
    .order('display_order', { ascending: direction === 'down' })
    .limit(1)

  const { data: sibling, error: siblingError } =
    direction === 'up'
      ? await siblingQuery
          .lt('display_order', currentShot.display_order)
          .maybeSingle()
      : await siblingQuery
          .gt('display_order', currentShot.display_order)
          .maybeSingle()

  if (siblingError) {
    return NextResponse.json(
      { success: false, error: siblingError.message },
      { status: 500 }
    )
  }

  if (!sibling) {
    return NextResponse.json(
      {
        success: false,
        error: direction === 'up' ? '已經喺最頂' : '已經喺最底',
      },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const first = await supabase
    .from('storyboard_shots')
    .update({ display_order: sibling.display_order, updated_at: now })
    .eq('id', currentShot.id)
  const second = await supabase
    .from('storyboard_shots')
    .update({ display_order: currentShot.display_order, updated_at: now })
    .eq('id', sibling.id)

  if (first.error || second.error) {
    return NextResponse.json(
      { success: false, error: first.error?.message ?? second.error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'

import { getSupabaseServer } from '@/lib/supabase-server'

const ALLOWED_FIELDS = ['subject_reference', 'title', 'status']

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        const value = body[key]
        update[key] = value === '' ? null : value
      }
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('storyboards')
      .update(update)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, storyboard: data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Update storyboard failed',
      },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

import { generateProductionPrompt } from '@/lib/production-prompt-generator'
import { getSupabaseServer } from '@/lib/supabase-server'
import { mapShotRow } from '@/lib/storyboard-fetch'

export async function POST(
  _request: Request,
  { params }: { params: { shotId: string } }
) {
  try {
    const { prompt, sourceAtGeneration } = await generateProductionPrompt(
      params.shotId
    )

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('storyboard_shots')
      .update({
        production_prompt: prompt,
        production_prompt_generated_at: new Date().toISOString(),
        production_prompt_for_source: sourceAtGeneration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.shotId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, shot: mapShotRow(data) })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Production prompt generation failed',
      },
      { status: 500 }
    )
  }
}

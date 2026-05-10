import { getSupabaseServer } from './supabase-server'
import type { StoryboardJSON } from './storyboard-export'

export async function importStoryboardFromJSON(data: StoryboardJSON): Promise<{
  newScriptId: string
  newStoryboardId: string
  shotCount: number
}> {
  if (data.version !== '1.0' && data.version !== 1) {
    throw new Error(`Unsupported JSON version: ${data.version}`)
  }
  if (!data.script || !data.storyboard || !Array.isArray(data.shots)) {
    throw new Error('Invalid storyboard JSON structure')
  }

  const supabase = getSupabaseServer()

  const { data: newScript, error: scriptError } = await supabase
    .from('scripts')
    .insert({
      topic: `[Imported] ${data.script.topic}`,
      background: data.script.background,
      framework: data.script.framework,
      hook_variant: data.script.hookVariant,
      tone: data.script.tone,
      target_minutes: data.script.targetMinutes,
      parts: data.script.parts,
      pivot_sentences: data.script.pivotSentences,
      title: data.script.title,
      model: data.script.model,
    })
    .select('id')
    .single()
  if (scriptError || !newScript) {
    throw new Error(`Script create failed: ${scriptError?.message}`)
  }

  const { data: newStoryboard, error: storyboardError } = await supabase
    .from('storyboards')
    .insert({
      script_id: newScript.id,
      title: data.storyboard.title,
      status: 'draft',
    })
    .select('id')
    .single()
  if (storyboardError || !newStoryboard) {
    throw new Error(`Storyboard create failed: ${storyboardError?.message}`)
  }

  const shotRows = data.shots.map((shot) => ({
    storyboard_id: newStoryboard.id,
    script_part_role: shot.scriptPartRole,
    display_order: shot.displayOrder,
    part_order: shot.partOrder,
    description: shot.description,
    script_excerpt: shot.scriptExcerpt,
    visual_instruction: shot.visualInstruction,
    content_type_slug: shot.contentTypeSlug,
    visual_mode_slug: shot.visualModeSlug,
    footage_source_slug: shot.footageSourceSlug,
    duration_seconds: shot.durationSeconds,
    notes: shot.notes,
    production_prompt: shot.productionPrompt,
    production_prompt_for_source: shot.productionPromptForSource,
    production_prompt_generated_at: shot.productionPromptGeneratedAt,
    stock_keyword: shot.stockKeyword,
  }))

  if (shotRows.length > 0) {
    const { error: shotsError } = await supabase
      .from('storyboard_shots')
      .insert(shotRows)
    if (shotsError) throw new Error(`Shots create failed: ${shotsError.message}`)
  }

  await supabase
    .from('scripts')
    .update({ storyboard_id: newStoryboard.id, updated_at: new Date().toISOString() })
    .eq('id', newScript.id)

  return {
    newScriptId: newScript.id,
    newStoryboardId: newStoryboard.id,
    shotCount: shotRows.length,
  }
}

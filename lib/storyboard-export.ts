import { getSupabaseServer } from './supabase-server'

export interface StoryboardJSON {
  version: '1.0' | 1
  exportedAt: string
  script: {
    id: string
    topic: string
    background: string | null
    framework: string
    hookVariant: string
    tone: string
    targetMinutes: number
    parts: unknown[]
    pivotSentences: unknown
    title: string | null
    model: string | null
    generatedAt: string | null
  }
  storyboard: {
    id: string
    title: string | null
    status: string
    subjectReference: string | null
    createdAt: string
  }
  shots: Array<{
    scriptPartRole: string
    displayOrder: number
    partOrder: number
    description: string
    scriptExcerpt: string | null
    visualInstruction: string | null
    contentTypeSlug: string | null
    visualModeSlug: string
    footageSourceSlug: string
    durationSeconds: number | null
    notes: string | null
    productionPrompt: string | null
    productionPromptForSource: string | null
    productionPromptGeneratedAt: string | null
    stockKeyword: string | null
  }>
}

export async function exportStoryboardAsJSON(
  storyboardId: string
): Promise<StoryboardJSON> {
  const supabase = getSupabaseServer()

  const { data: storyboard, error: storyboardError } = await supabase
    .from('storyboards')
    .select('*')
    .eq('id', storyboardId)
    .single()
  if (storyboardError || !storyboard) {
    throw new Error(storyboardError?.message ?? 'Storyboard not found')
  }

  const { data: script, error: scriptError } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', storyboard.script_id)
    .single()
  if (scriptError || !script) {
    throw new Error(scriptError?.message ?? 'Script not found')
  }

  const { data: shots, error: shotsError } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('storyboard_id', storyboardId)
    .order('display_order', { ascending: true })
  if (shotsError) throw new Error(shotsError.message)

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    script: {
      id: script.id,
      topic: script.topic,
      background: script.background ?? null,
      framework: script.framework,
      hookVariant: script.hook_variant,
      tone: script.tone,
      targetMinutes: script.target_minutes,
      parts: script.parts ?? [],
      pivotSentences: script.pivot_sentences ?? null,
      title: script.title ?? null,
      model: script.model ?? null,
      generatedAt: script.generated_at ?? script.created_at ?? null,
    },
    storyboard: {
      id: storyboard.id,
      title: storyboard.title ?? null,
      status: storyboard.status,
      subjectReference: storyboard.subject_reference ?? null,
      createdAt: storyboard.created_at,
    },
    shots: (shots ?? []).map((shot) => ({
      scriptPartRole: shot.script_part_role,
      displayOrder: shot.display_order,
      partOrder: shot.part_order,
      description: shot.description,
      scriptExcerpt: shot.script_excerpt ?? null,
      visualInstruction: shot.visual_instruction ?? null,
      contentTypeSlug: shot.content_type_slug ?? null,
      visualModeSlug: shot.visual_mode_slug,
      footageSourceSlug: shot.footage_source_slug,
      durationSeconds: shot.duration_seconds ?? null,
      notes: shot.notes ?? null,
      productionPrompt: shot.production_prompt ?? null,
      productionPromptForSource: shot.production_prompt_for_source ?? null,
      productionPromptGeneratedAt: shot.production_prompt_generated_at ?? null,
      stockKeyword: shot.stock_keyword ?? null,
    })),
  }
}

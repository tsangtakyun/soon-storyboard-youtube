import { getSupabaseServer } from './supabase-server'
import type { StoryboardJSON } from './storyboard-export'

type ImportableStoryboardJSON = StoryboardJSON | LegacySoonScriptProject

interface LegacySoonScriptProject {
  version: number | string
  type?: string
  topic?: string
  background?: string | null
  framework?: string
  hookVariant?: string
  tone?: string
  targetMinutes?: number
  outlineId?: string | null
  structuredScript?: {
    title?: string | null
    topic?: string
    background?: string | null
    framework?: string
    hookVariant?: string
    tone?: string
    targetMinutes?: number
    outlineId?: string | null
    parts?: unknown[]
    pivotSentences?: unknown
    meta?: {
      generatedAt?: string
      schemaVersion?: string
    }
  }
}

function normalizeImportData(data: ImportableStoryboardJSON): StoryboardJSON {
  const maybeStoryboard = data as StoryboardJSON
  if (maybeStoryboard.script && maybeStoryboard.storyboard && Array.isArray(maybeStoryboard.shots)) {
    return maybeStoryboard
  }

  const legacy = data as LegacySoonScriptProject
  if (legacy.type !== 'soon-script-project' || !legacy.structuredScript) {
    throw new Error('Invalid storyboard JSON structure')
  }

  const script = legacy.structuredScript
  const topic = script.topic ?? legacy.topic ?? 'Imported SOON script'

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    script: {
      id: '',
      topic,
      background: script.background ?? legacy.background ?? null,
      framework: script.framework ?? legacy.framework ?? 'fern_6part',
      hookVariant: script.hookVariant ?? legacy.hookVariant ?? 'thesis',
      tone: script.tone ?? legacy.tone ?? 'documentary',
      targetMinutes: script.targetMinutes ?? legacy.targetMinutes ?? 10,
      parts: script.parts ?? [],
      pivotSentences: script.pivotSentences ?? null,
      title: script.title ?? topic,
      model: 'legacy-soon-project-json',
      generatedAt: script.meta?.generatedAt ?? null,
    },
    storyboard: {
      id: '',
      title: script.title ?? topic,
      status: 'draft',
      createdAt: new Date().toISOString(),
    },
    shots: [],
  }
}

export async function importStoryboardFromJSON(input: ImportableStoryboardJSON): Promise<{
  newScriptId: string
  newStoryboardId: string
  shotCount: number
}> {
  if (!['1', '1.0'].includes(String(input.version))) {
    throw new Error(`Unsupported JSON version: ${input.version}`)
  }
  const data = normalizeImportData(input)

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

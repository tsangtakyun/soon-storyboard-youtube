import { getSupabaseServer } from './supabase-server'
import type { Script, Storyboard, StoryboardShot } from './types'

export async function fetchScript(scriptId: string): Promise<Script | null> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', scriptId)
    .single()

  if (error || !data) return null
  return mapScriptRow(data)
}

export async function fetchStoryboardByScriptId(
  scriptId: string
): Promise<Storyboard | null> {
  const supabase = getSupabaseServer()
  const { data: storyboard, error } = await supabase
    .from('storyboards')
    .select('*')
    .eq('script_id', scriptId)
    .maybeSingle()

  if (error || !storyboard) return null

  const { data: shots, error: shotsError } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('storyboard_id', storyboard.id)
    .order('display_order', { ascending: true })

  if (shotsError) {
    throw new Error(shotsError.message)
  }

  return {
    id: storyboard.id,
    scriptId: storyboard.script_id,
    title: storyboard.title ?? undefined,
    status: storyboard.status,
    shots: (shots ?? []).map(mapShotRow),
    createdAt: storyboard.created_at,
    updatedAt: storyboard.updated_at,
  }
}

export async function fetchScriptByStoryboard(
  storyboardId: string
): Promise<Script | null> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('storyboards')
    .select('script_id')
    .eq('id', storyboardId)
    .single()

  if (error || !data?.script_id) return null
  return fetchScript(data.script_id)
}

export async function createStoryboard(scriptId: string): Promise<string> {
  const supabase = getSupabaseServer()
  const { data: script } = await supabase
    .from('scripts')
    .select('title,topic')
    .eq('id', scriptId)
    .single()

  const { data, error } = await supabase
    .from('storyboards')
    .insert({
      script_id: scriptId,
      title: script?.title ?? script?.topic ?? null,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create storyboard')
  }

  await supabase
    .from('scripts')
    .update({ storyboard_id: data.id, updated_at: new Date().toISOString() })
    .eq('id', scriptId)

  return data.id
}

function mapScriptRow(row: any): Script {
  return {
    id: row.id,
    topic: row.topic,
    background: row.background ?? undefined,
    framework: row.framework,
    hookVariant: row.hook_variant,
    tone: row.tone,
    targetMinutes: row.target_minutes,
    outlineId: row.outline_id ?? undefined,
    parts: row.parts ?? [],
    pivotSentences: row.pivot_sentences ?? undefined,
    title: row.title ?? undefined,
    generatedAt: row.generated_at ?? row.created_at,
    model: row.model ?? undefined,
    storyboardId: row.storyboard_id ?? undefined,
  }
}

export function mapShotRow(row: any): StoryboardShot {
  return {
    id: row.id,
    storyboardId: row.storyboard_id,
    scriptPartRole: row.script_part_role,
    displayOrder: row.display_order,
    partOrder: row.part_order,
    description: row.description,
    visualModeSlug: row.visual_mode_slug,
    footageSourceSlug: row.footage_source_slug,
    durationSeconds: row.duration_seconds ?? undefined,
    generationUrl: row.generation_url ?? undefined,
    generationStatus: row.generation_status ?? undefined,
    generationMetadata: row.generation_metadata ?? undefined,
    stockKeyword: row.stock_keyword ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

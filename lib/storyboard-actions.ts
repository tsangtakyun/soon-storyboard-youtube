import { getSupabaseServer } from './supabase-server'
import { mapShotRow } from './storyboard-fetch'
import type {
  FootageSourceSlug,
  ScriptPartRole,
  StoryboardShot,
  VisualModeSlug,
} from './types'

export function mapShotUpdate(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('description' in body) update.description = String(body.description ?? '')
  if ('visualModeSlug' in body) update.visual_mode_slug = body.visualModeSlug
  if ('visual_mode_slug' in body) update.visual_mode_slug = body.visual_mode_slug
  if ('footageSourceSlug' in body) {
    update.footage_source_slug = body.footageSourceSlug
  }
  if ('footage_source_slug' in body) {
    update.footage_source_slug = body.footage_source_slug
  }
  if ('durationSeconds' in body) {
    update.duration_seconds =
      body.durationSeconds === null || body.durationSeconds === ''
        ? null
        : Number(body.durationSeconds)
  }
  if ('duration_seconds' in body) {
    update.duration_seconds =
      body.duration_seconds === null || body.duration_seconds === ''
        ? null
        : Number(body.duration_seconds)
  }
  if ('stockKeyword' in body) update.stock_keyword = body.stockKeyword || null
  if ('stock_keyword' in body) update.stock_keyword = body.stock_keyword || null
  if ('notes' in body) update.notes = body.notes || null

  return update
}

export async function listShots(storyboardId: string): Promise<StoryboardShot[]> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('storyboard_id', storyboardId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapShotRow)
}

export async function createShot(args: {
  storyboardId: string
  scriptPartRole: ScriptPartRole
  visualModeSlug?: VisualModeSlug
  footageSourceSlug?: FootageSourceSlug
  description?: string
  durationSeconds?: number | null
}) {
  if (args.footageSourceSlug === 'synthetic_host') {
    throw new Error('主持 AI 重建暫未啟用')
  }

  const supabase = getSupabaseServer()
  const { data: maxRow } = await supabase
    .from('storyboard_shots')
    .select('display_order')
    .eq('storyboard_id', args.storyboardId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newOrder = (maxRow?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from('storyboard_shots')
    .insert({
      storyboard_id: args.storyboardId,
      script_part_role: args.scriptPartRole,
      display_order: newOrder,
      part_order: 0,
      description: args.description ?? '',
      visual_mode_slug: args.visualModeSlug ?? 'talking_head',
      footage_source_slug: args.footageSourceSlug ?? 'live_shoot',
      duration_seconds: args.durationSeconds ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapShotRow(data)
}

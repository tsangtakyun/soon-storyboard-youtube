import { getSupabaseServer } from './supabase-server'
import type { FootageSource, VisualMode } from './types'

export async function fetchVisualModes(): Promise<VisualMode[]> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('layer_2_visual_modes')
    .select(
      'slug,label_zh,label_en,description,default_part_pairings,default_source_priority,display_order'
    )
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    description: row.description,
    defaultPartPairings: row.default_part_pairings ?? [],
    defaultSourcePriority: row.default_source_priority ?? [],
    displayOrder: row.display_order,
  }))
}

export async function fetchFootageSources(): Promise<FootageSource[]> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('layer_2_footage_sources')
    .select(
      'slug,label_zh,emoji,description,display_order,production_prompt_label,production_prompt_template'
    )
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    labelZh: row.label_zh,
    emoji: row.emoji,
    description: row.description,
    displayOrder: row.display_order,
    productionPromptLabel: row.production_prompt_label ?? undefined,
    productionPromptTemplate: row.production_prompt_template ?? undefined,
  }))
}

export async function fetchLayer2Options(): Promise<{
  visualModes: VisualMode[]
  footageSources: FootageSource[]
}> {
  const [visualModes, footageSources] = await Promise.all([
    fetchVisualModes(),
    fetchFootageSources(),
  ])

  return {
    visualModes,
    footageSources,
  }
}

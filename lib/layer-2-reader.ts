import { getSupabaseServer } from './supabase-server'
import type { FootageSource, VisualMode } from './types'

export async function fetchLayer2Options(): Promise<{
  visualModes: VisualMode[]
  footageSources: FootageSource[]
}> {
  const supabase = getSupabaseServer()

  const [visualModesResult, footageSourcesResult] = await Promise.all([
    supabase
      .from('layer_2_visual_modes')
      .select('slug,label_zh,label_en,description,display_order')
      .order('display_order', { ascending: true }),
    supabase
      .from('layer_2_footage_sources')
      .select('slug,label_zh,emoji,description,display_order')
      .order('display_order', { ascending: true }),
  ])

  if (visualModesResult.error) {
    throw new Error(visualModesResult.error.message)
  }
  if (footageSourcesResult.error) {
    throw new Error(footageSourcesResult.error.message)
  }

  return {
    visualModes: (visualModesResult.data ?? []).map((row) => ({
      slug: row.slug,
      labelZh: row.label_zh,
      labelEn: row.label_en,
      description: row.description,
      displayOrder: row.display_order,
    })),
    footageSources: (footageSourcesResult.data ?? []).map((row) => ({
      slug: row.slug,
      labelZh: row.label_zh,
      emoji: row.emoji,
      description: row.description,
      displayOrder: row.display_order,
    })),
  }
}

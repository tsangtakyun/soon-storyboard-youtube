import Anthropic from '@anthropic-ai/sdk'

import { getSupabaseServer } from './supabase-server'
import type { FootageSourceSlug } from './types'

function fillTemplate(template: string, values: Record<string, string>) {
  let result = template
  for (const [key, value] of Object.entries(values)) {
    result = result.split(`{${key}}`).join(value)
  }
  return result
}

export async function generateProductionPrompt(
  shotId: string
): Promise<{ prompt: string; sourceAtGeneration: FootageSourceSlug }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

  const supabase = getSupabaseServer()

  const { data: shot, error: shotError } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('id', shotId)
    .single()

  if (shotError || !shot) throw new Error(shotError?.message ?? 'Shot not found')
  if (shot.footage_source_slug === 'synthetic_host') {
    throw new Error('主持 AI 重建暫未啟用')
  }

  const { data: footageSource, error: sourceError } = await supabase
    .from('layer_2_footage_sources')
    .select('*')
    .eq('slug', shot.footage_source_slug)
    .single()

  if (sourceError || !footageSource) {
    throw new Error(sourceError?.message ?? 'Footage source not found')
  }
  if (!footageSource.production_prompt_template) {
    throw new Error(`No production prompt template for ${shot.footage_source_slug}`)
  }

  const [visualModeResult, contentTypeResult, storyboardResult] = await Promise.all([
    supabase
      .from('layer_2_visual_modes')
      .select('label_zh,label_en')
      .eq('slug', shot.visual_mode_slug)
      .maybeSingle(),
    shot.content_type_slug
      ? supabase
          .from('layer_2_content_types')
          .select('label_zh,label_en')
          .eq('slug', shot.content_type_slug)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('storyboards')
      .select('subject_reference')
      .eq('id', shot.storyboard_id)
      .maybeSingle(),
  ])

  const prompt = fillTemplate(footageSource.production_prompt_template, {
    visual_instruction: shot.visual_instruction ?? shot.description ?? '',
    script_excerpt: shot.script_excerpt ?? shot.description ?? '',
    visual_mode_label:
      visualModeResult.data?.label_zh ??
      visualModeResult.data?.label_en ??
      shot.visual_mode_slug,
    duration_seconds: String(shot.duration_seconds ?? 5),
    content_type_label:
      contentTypeResult.data?.label_zh ??
      contentTypeResult.data?.label_en ??
      shot.content_type_slug ??
      'unknown',
    subject_reference:
      storyboardResult.data?.subject_reference?.trim() || '（無）',
  })

  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const generated = response.content
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()

  return {
    prompt: generated,
    sourceAtGeneration: shot.footage_source_slug as FootageSourceSlug,
  }
}

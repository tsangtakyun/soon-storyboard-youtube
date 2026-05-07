import Anthropic from '@anthropic-ai/sdk'

import { getSupabaseServer } from './supabase-server'
import type { FootageSourceSlug, Script, ScriptPartRole, VisualModeSlug } from './types'

export interface GeneratedShot {
  scriptPartRole: ScriptPartRole
  partOrder: number
  scriptExcerpt: string
  visualInstruction: string
  contentTypeSlug: string
  visualModeSlug: VisualModeSlug
  footageSourceSlug: FootageSourceSlug
  durationSeconds: number
  notes?: string
}

function extractJsonObject(rawText: string): string | null {
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) return fenceMatch[1].trim()

  const firstBrace = rawText.indexOf('{')
  const lastBrace = rawText.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return null
  return rawText.slice(firstBrace, lastBrace + 1)
}

async function fetchLayer2(table: string) {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from(`layer_2_${table}`)
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

function buildPrompt(script: Script, contentTypes: any[], visualModes: any[], footageSources: any[]) {
  return [
    '你係 SOON 嘅資深紀錄片導演。任務：將以下 script 拆成 storyboard shot list。',
    '',
    '## Production directive',
    '盡量減少現場拍 shot count。優先用 stock、網上 footage、AI generation、custom motion design。',
    '只有 host_thesis、organic_moment、comparison_contrast、以及 SOON 主場景 urban_life 才偏向 live_shoot。',
    'synthetic_host 暫未啟用，嚴禁輸出 footage_source_slug = synthetic_host。',
    '',
    '## Content Types',
    contentTypes
      .map(
        (ct) =>
          `- ${ct.slug}: ${ct.label_zh} / ${ct.label_en}\n  描述: ${ct.description}\n  Hints: ${(ct.identification_hints ?? []).join(' / ')}\n  Default: ${ct.default_visual_mode_slug} + ${ct.default_footage_source_slug}\n  Duration: ${ct.typical_duration_min}-${ct.typical_duration_max}s\n  Note: ${ct.production_note ?? ''}`
      )
      .join('\n'),
    '',
    '## Visual Modes',
    visualModes.map((vm) => `- ${vm.slug}: ${vm.label_zh}`).join('\n'),
    '',
    '## Footage Sources',
    footageSources
      .filter((fs) => fs.slug !== 'synthetic_host')
      .map((fs) => `- ${fs.slug}: ${fs.emoji} ${fs.label_zh}`)
      .join('\n'),
    '',
    '## Script',
    `Topic: ${script.topic}`,
    `Tone: ${script.tone}`,
    `Hook variant: ${script.hookVariant}`,
    `Target minutes: ${script.targetMinutes}`,
    '',
    script.parts
      .map(
        (part) =>
          `### ${part.role} (${part.order + 1})\n${part.content}`
      )
      .join('\n\n'),
    '',
    '## Output',
    '輸出 JSON object only，唔好 Markdown。',
    '每個 shot 必須有：script_part_role, part_order, script_excerpt, visual_instruction, content_type_slug, visual_mode_slug, footage_source_slug, duration_seconds, notes。',
    'script_excerpt 必須係原文 excerpt；visual_instruction 必須係具體畫面 instruction，唔可以只 copy narration。',
    '5 分鐘片約 25-45 shots；10 分鐘片約 50-85 shots；20 分鐘片約 100-180 shots。',
    '',
    '{ "shots": [ { "script_part_role": "hook", "part_order": 0, "script_excerpt": "...", "visual_instruction": "...", "content_type_slug": "host_thesis", "visual_mode_slug": "talking_head", "footage_source_slug": "live_shoot", "duration_seconds": 8, "notes": "..." } ] }',
  ].join('\n')
}

export function parseShotListResponse(rawText: string): GeneratedShot[] {
  const jsonText = extractJsonObject(rawText)
  if (!jsonText) throw new Error('AI response 入面搵唔到 JSON object')

  const parsed = JSON.parse(jsonText) as { shots?: any[] }
  if (!Array.isArray(parsed.shots)) throw new Error('AI response 缺少 shots array')

  return parsed.shots.map((shot, index) => ({
    scriptPartRole: shot.script_part_role ?? shot.scriptPartRole,
    partOrder: Number(shot.part_order ?? shot.partOrder ?? index),
    scriptExcerpt: String(shot.script_excerpt ?? shot.scriptExcerpt ?? ''),
    visualInstruction: String(shot.visual_instruction ?? shot.visualInstruction ?? ''),
    contentTypeSlug: String(shot.content_type_slug ?? shot.contentTypeSlug ?? ''),
    visualModeSlug: shot.visual_mode_slug ?? shot.visualModeSlug,
    footageSourceSlug: shot.footage_source_slug ?? shot.footageSourceSlug,
    durationSeconds: Math.max(1, Number(shot.duration_seconds ?? shot.durationSeconds ?? 5)),
    notes: shot.notes ? String(shot.notes) : undefined,
  }))
}

export async function generateAIStoryboard(script: Script): Promise<GeneratedShot[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

  const [contentTypes, visualModes, footageSources] = await Promise.all([
    fetchLayer2('content_types'),
    fetchLayer2('visual_modes'),
    fetchLayer2('footage_sources'),
  ])

  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: buildPrompt(script, contentTypes, visualModes, footageSources),
      },
    ],
  })

  const rawText = response.content
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()

  const shots = parseShotListResponse(rawText)
  const validFootageSources = new Set(
    footageSources.filter((fs) => fs.slug !== 'synthetic_host').map((fs) => fs.slug)
  )
  const validVisualModes = new Set(visualModes.map((vm) => vm.slug))
  const validContentTypes = new Set(contentTypes.map((ct) => ct.slug))

  for (const shot of shots) {
    if (!validFootageSources.has(shot.footageSourceSlug)) {
      throw new Error(`Invalid footage source: ${shot.footageSourceSlug}`)
    }
    if (!validVisualModes.has(shot.visualModeSlug)) {
      throw new Error(`Invalid visual mode: ${shot.visualModeSlug}`)
    }
    if (!validContentTypes.has(shot.contentTypeSlug)) {
      throw new Error(`Invalid content type: ${shot.contentTypeSlug}`)
    }
  }

  return shots
}

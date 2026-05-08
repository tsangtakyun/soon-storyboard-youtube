import Anthropic from '@anthropic-ai/sdk'

import {
  buildRetryPrompt,
  validateScriptCoverage,
  type CoverageResult,
  type HallucinatedShot,
} from './script-coverage-validator'
import { getSupabaseServer } from './supabase-server'
import type {
  FootageSourceSlug,
  Script,
  ScriptPartRole,
  VisualModeSlug,
} from './types'

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

export class ScriptCoverageError extends Error {
  details: {
    missingSentences: string[]
    hallucinatedShots: HallucinatedShot[]
    forwardRatio: number
    reverseRatio: number
    totalSentences: number
    totalShots: number
    generatedShots: GeneratedShot[]
  }

  constructor(message: string, details: ScriptCoverageError['details']) {
    super(message)
    this.name = 'ScriptCoverageError'
    this.details = details
  }
}

function extractJsonObject(rawText: string): string | null {
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) return fenceMatch[1].trim()

  const firstBrace = rawText.indexOf('{')
  const lastBrace = rawText.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null
  }
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

function targetShotRange(targetMinutes: number) {
  if (targetMinutes <= 6) return '18-28'
  if (targetMinutes <= 12) return '35-55'
  return '70-120'
}

function buildPrompt(
  script: Script,
  contentTypes: any[],
  visualModes: any[],
  footageSources: any[]
) {
  return [
    "You are SOON's senior documentary director. Convert the script into a production storyboard shot list.",
    '',
    'CRITICAL JSON RULES:',
    '- Return one valid JSON object only.',
    '- No Markdown, no code fence, no comments.',
    '- Every array element must be separated by a comma.',
    '- Escape all quotation marks inside string values.',
    '- Keep strings concise so the JSON is not truncated.',
    '',
    'CRITICAL FULL SCRIPT COVERAGE:',
    '- Storyboard is a 1:1 map between script and visuals.',
    '- Every sentence in the script must appear in at least one shot.script_excerpt.',
    '- Do not skip transitional, structural, or pivot sentences.',
    '- Sentences beginning with "但係", "換言之", "另一方面", "首先", "其次", "最後", "我們就需要問" are mandatory coverage.',
    '- You may combine 2-3 short sentences in one shot, but you must include the full original sentences.',
    '- For long sentences, split across multiple shots if needed, but the substrings together must cover the whole sentence.',
    '- Before output, concatenate all script_excerpt values in order and verify no original sentence is missing.',
    '',
    'CRITICAL NO HALLUCINATION:',
    '- Every shot.script_excerpt must be a verbatim substring from the original script.',
    '- Do not add narrative completion. If the script says "首先" and "其次" but has no "第三", you must not invent "第三".',
    '- Do not add transition sentences, bridge sentences, explanations, synonyms, or rewritten wording.',
    '- Every character in script_excerpt should be traceable to the original script text.',
    '',
    'Production directive:',
    '- Minimize live_shoot. Prefer stock, internet footage, AI generation, and custom motion design.',
    '- Use live_shoot mainly for host_thesis, organic_moment, comparison_contrast, and SOON home-city urban_life.',
    '- synthetic_host is disabled. Never output footage_source_slug = synthetic_host.',
    '',
    'Content types:',
    contentTypes
      .map(
        (ct) =>
          `- ${ct.slug}: ${ct.label_zh} / ${ct.label_en}. Default ${ct.default_visual_mode_slug} + ${ct.default_footage_source_slug}. Duration ${ct.typical_duration_min}-${ct.typical_duration_max}s. Hints: ${(ct.identification_hints ?? []).join(' / ')}`
      )
      .join('\n'),
    '',
    'Visual modes:',
    visualModes.map((vm) => `- ${vm.slug}: ${vm.label_zh}`).join('\n'),
    '',
    'Footage sources:',
    footageSources
      .filter((fs) => fs.slug !== 'synthetic_host')
      .map((fs) => `- ${fs.slug}: ${fs.emoji} ${fs.label_zh}`)
      .join('\n'),
    '',
    'Script:',
    `Topic: ${script.topic}`,
    `Tone: ${script.tone}`,
    `Hook variant: ${script.hookVariant}`,
    `Target minutes: ${script.targetMinutes}`,
    '',
    script.parts
      .map((part) => `### ${part.role} (${part.order + 1})\n${part.content}`)
      .join('\n\n'),
    '',
    'Task:',
    `Create ${targetShotRange(script.targetMinutes)} shots for this script.`,
    'For each shot:',
    '- script_excerpt: exact narration excerpt from the script. Do not rewrite.',
    '- visual_instruction: specific production visual direction. Do not just copy narration.',
    '- content_type_slug: one of the content types above.',
    '- visual_mode_slug: one of the visual modes above.',
    '- footage_source_slug: one of the enabled footage sources above.',
    '- duration_seconds: practical estimate.',
    '',
    'Output schema:',
    '{"shots":[{"script_part_role":"hook","part_order":0,"script_excerpt":"...","visual_instruction":"...","content_type_slug":"host_thesis","visual_mode_slug":"talking_head","footage_source_slug":"live_shoot","duration_seconds":8,"notes":"optional"}]}',
  ].join('\n')
}

function normalizeShot(shot: any, index: number): GeneratedShot {
  return {
    scriptPartRole: shot.script_part_role ?? shot.scriptPartRole,
    partOrder: Number(shot.part_order ?? shot.partOrder ?? index),
    scriptExcerpt: String(shot.script_excerpt ?? shot.scriptExcerpt ?? ''),
    visualInstruction: String(
      shot.visual_instruction ?? shot.visualInstruction ?? ''
    ),
    contentTypeSlug: String(shot.content_type_slug ?? shot.contentTypeSlug ?? ''),
    visualModeSlug: shot.visual_mode_slug ?? shot.visualModeSlug,
    footageSourceSlug: shot.footage_source_slug ?? shot.footageSourceSlug,
    durationSeconds: Math.max(
      1,
      Number(shot.duration_seconds ?? shot.durationSeconds ?? 5)
    ),
    notes: shot.notes ? String(shot.notes) : undefined,
  }
}

export function parseShotListResponse(rawText: string): GeneratedShot[] {
  const jsonText = extractJsonObject(rawText)
  if (!jsonText) throw new Error('AI response 入面搵唔到 JSON object')

  let parsed: { shots?: any[] }
  try {
    parsed = JSON.parse(jsonText) as { shots?: any[] }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown JSON parse error'
    throw new Error(`AI storyboard JSON 格式錯誤：${message}`)
  }

  if (!Array.isArray(parsed.shots)) {
    throw new Error('AI response 缺少 shots array')
  }
  return parsed.shots.map(normalizeShot)
}

async function repairJsonWithClaude(
  anthropic: Anthropic,
  rawText: string,
  parseError: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          'Repair the following invalid JSON into one valid minified JSON object.',
          'Do not change field names or semantic content.',
          'Return JSON only. No Markdown. No explanation.',
          `Parse error: ${parseError}`,
          '',
          rawText.slice(0, 24000),
        ].join('\n'),
      },
    ],
  })

  return response.content
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()
}

async function generateShots(
  anthropic: Anthropic,
  prompt: string
): Promise<GeneratedShot[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()

  try {
    return parseShotListResponse(rawText)
  } catch (error) {
    const repaired = await repairJsonWithClaude(
      anthropic,
      rawText,
      error instanceof Error ? error.message : 'JSON parse failed'
    )
    return parseShotListResponse(repaired)
  }
}

function validateShots(
  shots: GeneratedShot[],
  contentTypes: any[],
  visualModes: any[],
  footageSources: any[]
) {
  const validFootageSources = new Set(
    footageSources
      .filter((fs) => fs.slug !== 'synthetic_host')
      .map((fs) => fs.slug)
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
}

function throwCoverageError(coverage: CoverageResult, shots: GeneratedShot[]) {
  throw new ScriptCoverageError(
    `Storyboard generation 失敗：Forward missing ${coverage.missingSentences.length} 句，Hallucinated ${coverage.hallucinatedShots.length} shots。Retry 之後仍 incomplete。`,
    {
      missingSentences: coverage.missingSentences,
      hallucinatedShots: coverage.hallucinatedShots,
      forwardRatio: coverage.forwardRatio,
      reverseRatio: coverage.reverseRatio,
      totalSentences: coverage.totalSentences,
      totalShots: coverage.totalShots,
      generatedShots: shots,
    }
  )
}

export async function generateAIStoryboard(
  script: Script
): Promise<GeneratedShot[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

  const [contentTypes, visualModes, footageSources] = await Promise.all([
    fetchLayer2('content_types'),
    fetchLayer2('visual_modes'),
    fetchLayer2('footage_sources'),
  ])

  const anthropic = new Anthropic({ apiKey })
  const initialPrompt = buildPrompt(script, contentTypes, visualModes, footageSources)

  let shots = await generateShots(anthropic, initialPrompt)
  validateShots(shots, contentTypes, visualModes, footageSources)

  let coverage = validateScriptCoverage(script, shots)
  if (coverage.covered) return shots

  const retryPrompt = buildRetryPrompt(
    initialPrompt,
    shots,
    coverage.missingSentences,
    coverage.hallucinatedShots
  )
  shots = await generateShots(anthropic, retryPrompt)
  validateShots(shots, contentTypes, visualModes, footageSources)
  coverage = validateScriptCoverage(script, shots)

  if (!coverage.covered) {
    throwCoverageError(coverage, shots)
  }

  return shots
}

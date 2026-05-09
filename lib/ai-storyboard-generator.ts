import Anthropic from '@anthropic-ai/sdk'

import {
  buildRetryPrompt,
  validatePartCoverage,
  validateScriptCoverage,
  type CoverageResult,
  type HallucinatedShot,
} from './script-coverage-validator'
import { getSupabaseServer } from './supabase-server'
import type {
  FootageSourceSlug,
  Script,
  ScriptPart,
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
  if (targetMinutes <= 6) return '16-24'
  if (targetMinutes <= 12) return '32-50'
  return '70-110'
}

function targetPartShotRange(part: ScriptPart) {
  const ratio = part.durationRatio ?? 0
  if (part.role === 'hook' || part.role === 'resolution') return '3-8'
  if (ratio >= 0.18) return '8-16'
  return '5-12'
}

function layer2PromptBlock(contentTypes: any[], visualModes: any[], footageSources: any[]) {
  return [
    'Content types:',
    contentTypes
      .map(
        (ct) =>
          `- ${ct.slug}: ${ct.label_zh} / ${ct.label_en}. Default ${ct.default_visual_mode_slug} + ${ct.default_footage_source_slug}. Duration ${ct.typical_duration_min}-${ct.typical_duration_max}s.`
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
  ].join('\n')
}

function jsonAndFidelityRules() {
  return [
    'CRITICAL JSON RULES:',
    '- Return one valid JSON object only: {"shots":[...]}',
    '- No Markdown, no code fence, no comments.',
    '- Every array element must be separated by a comma.',
    '- Escape all quotation marks inside string values.',
    '- Keep visual_instruction under 90 Chinese characters.',
    '- Omit notes unless absolutely necessary.',
    '',
    'CRITICAL FIDELITY RULES:',
    '- Every source sentence must appear in at least one shot.script_excerpt.',
    '- Every shot.script_excerpt must be a verbatim substring from the allowed source text.',
    '- Do not skip transitional, structural, or pivot sentences.',
    '- Do not rewrite, paraphrase, add transition sentences, or invent missing structure.',
    '- If source says "首先" and "其次" but has no "第三", do not invent "第三".',
  ].join('\n')
}

function buildPrompt(
  script: Script,
  contentTypes: any[],
  visualModes: any[],
  footageSources: any[]
) {
  return [
    "You are SOON's senior documentary director. Convert the full script into a production storyboard shot list.",
    '',
    jsonAndFidelityRules(),
    '',
    'Production directive:',
    '- Minimize live_shoot. Prefer stock, internet footage, AI generation, and custom_motion_design.',
    '- Use custom_motion_design for data_viz and animation_diagram unless source evidence requires otherwise.',
    '- synthetic_host is disabled. Never output footage_source_slug = synthetic_host.',
    '',
    layer2PromptBlock(contentTypes, visualModes, footageSources),
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
    'Each shot must contain script_excerpt, visual_instruction, content_type_slug, visual_mode_slug, footage_source_slug, duration_seconds.',
    '',
    'Output schema:',
    '{"shots":[{"script_part_role":"hook","part_order":0,"script_excerpt":"...","visual_instruction":"...","content_type_slug":"host_thesis","visual_mode_slug":"talking_head","footage_source_slug":"live_shoot","duration_seconds":8}]}',
  ].join('\n')
}

function buildPartPrompt(
  script: Script,
  targetPart: ScriptPart,
  contentTypes: any[],
  visualModes: any[],
  footageSources: any[]
) {
  return [
    "You are SOON's senior documentary director. Generate storyboard shots for ONE script part only.",
    '',
    jsonAndFidelityRules(),
    '',
    'Allowed source text is ONLY the target part content. Full script is context only.',
    `Target part: ${targetPart.role} (${targetPart.order + 1}/${script.parts.length})`,
    '',
    'Production directive:',
    '- Minimize live_shoot. Prefer stock, internet footage, AI generation, and custom_motion_design.',
    '- Use custom_motion_design for statistic/data_viz and system_pattern/animation_diagram.',
    '- synthetic_host is disabled. Never output footage_source_slug = synthetic_host.',
    '',
    layer2PromptBlock(contentTypes, visualModes, footageSources),
    '',
    'Full script context (do not generate shots for non-target parts):',
    script.parts
      .map((part) => {
        const marker = part.role === targetPart.role ? ' TARGET' : ''
        return `### ${part.role}${marker}\n${part.content}`
      })
      .join('\n\n'),
    '',
    'Target part content to cover exactly:',
    targetPart.content,
    '',
    `Create ${targetPartShotRange(targetPart)} shots for this part only.`,
    `Every output shot must have script_part_role = "${targetPart.role}".`,
    'Each shot must contain script_excerpt, visual_instruction, content_type_slug, visual_mode_slug, footage_source_slug, duration_seconds.',
    '',
    'Output schema:',
    `{"shots":[{"script_part_role":"${targetPart.role}","part_order":0,"script_excerpt":"...","visual_instruction":"...","content_type_slug":"host_thesis","visual_mode_slug":"talking_head","footage_source_slug":"live_shoot","duration_seconds":8}]}`,
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

async function callClaude(
  anthropic: Anthropic,
  prompt: string,
  maxTokens = 12000
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()
}

async function repairJsonWithClaude(
  anthropic: Anthropic,
  rawText: string,
  parseError: string
): Promise<string> {
  return callClaude(
    anthropic,
    [
      'Repair this invalid JSON into one valid minified JSON object.',
      'Return JSON only. No Markdown. No explanation.',
      'The required top-level shape is {"shots":[...]}',
      'Preserve all existing fields and text as much as possible.',
      'Fix missing commas, unescaped quotes, dangling commas, and broken brackets.',
      'If the final object is truncated, close the last complete shot object and close the array/object.',
      `Parse error: ${parseError}`,
      '',
      rawText.slice(0, 50000),
    ].join('\n'),
    12000
  )
}

async function generateShots(
  anthropic: Anthropic,
  prompt: string
): Promise<GeneratedShot[]> {
  let rawText = await callClaude(anthropic, prompt)
  let lastError: unknown = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return parseShotListResponse(rawText)
    } catch (error) {
      lastError = error
      rawText = await repairJsonWithClaude(
        anthropic,
        rawText,
        error instanceof Error ? error.message : 'JSON parse failed'
      )
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('AI storyboard JSON 格式錯誤')
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

function throwCoverageError(
  label: string,
  coverage: CoverageResult,
  shots: GeneratedShot[]
): never {
  throw new ScriptCoverageError(
    `${label} generation 失敗：Forward missing ${coverage.missingSentences.length} 句，Hallucinated ${coverage.hallucinatedShots.length} shots。Retry 之後仍 incomplete。`,
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

async function getGeneratorContext() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

  const [contentTypes, visualModes, footageSources] = await Promise.all([
    fetchLayer2('content_types'),
    fetchLayer2('visual_modes'),
    fetchLayer2('footage_sources'),
  ])

  return {
    anthropic: new Anthropic({ apiKey }),
    contentTypes,
    visualModes,
    footageSources,
  }
}

export async function generateAIStoryboard(
  script: Script
): Promise<GeneratedShot[]> {
  const { anthropic, contentTypes, visualModes, footageSources } =
    await getGeneratorContext()
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

  if (!coverage.covered) throwCoverageError('Storyboard', coverage, shots)
  return shots
}

export async function generateAIStoryboardForPart(
  script: Script,
  targetPartRole: ScriptPartRole
): Promise<GeneratedShot[]> {
  const targetPart = script.parts.find((part) => part.role === targetPartRole)
  if (!targetPart) throw new Error(`Script part "${targetPartRole}" not found`)

  const { anthropic, contentTypes, visualModes, footageSources } =
    await getGeneratorContext()
  const initialPrompt = buildPartPrompt(
    script,
    targetPart,
    contentTypes,
    visualModes,
    footageSources
  )

  let shots = await generateShots(anthropic, initialPrompt)
  shots = shots.map((shot, index) => ({
    ...shot,
    scriptPartRole: targetPartRole,
    partOrder: index,
  }))
  validateShots(shots, contentTypes, visualModes, footageSources)

  let coverage = validatePartCoverage(targetPart, shots)
  if (coverage.covered) return shots

  const retryPrompt = buildRetryPrompt(
    initialPrompt,
    shots,
    coverage.missingSentences,
    coverage.hallucinatedShots
  )
  shots = await generateShots(anthropic, retryPrompt)
  shots = shots.map((shot, index) => ({
    ...shot,
    scriptPartRole: targetPartRole,
    partOrder: index,
  }))
  validateShots(shots, contentTypes, visualModes, footageSources)
  coverage = validatePartCoverage(targetPart, shots)

  if (!coverage.covered) throwCoverageError('Per-part storyboard', coverage, shots)
  return shots
}

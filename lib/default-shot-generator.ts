import { getSupabaseServer } from './supabase-server'
import type {
  FootageSourceSlug,
  Script,
  ScriptPartRole,
  StoryboardShotDraft,
  VisualModeSlug,
} from './types'

const SUPPORTED_PART_ROLES: ScriptPartRole[] = [
  'hook',
  'setup',
  'detail',
  'complication',
  'depth',
  'resolution',
]

const SHOTS_PER_PART: Partial<Record<ScriptPartRole, number>> = {
  hook: 1,
  setup: 2,
  detail: 3,
  complication: 2,
  depth: 2,
  resolution: 1,
}

function estimatePartDurationSeconds(
  script: Script,
  part: Script['parts'][number]
): number {
  if (part.estimatedDurationSeconds && part.estimatedDurationSeconds > 0) {
    return part.estimatedDurationSeconds
  }

  if (part.durationRatio && part.durationRatio > 0) {
    return Math.round(script.targetMinutes * 60 * part.durationRatio)
  }

  return Math.max(20, Math.round((script.targetMinutes * 60) / script.parts.length))
}

function createDescription(content: string, shotIndex: number, shotCount: number) {
  const clean = content.replace(/\s+/g, ' ').trim()
  if (!clean) return '補充呢個 shot 要呈現嘅畫面。'

  const sliceStart = Math.floor((clean.length / shotCount) * shotIndex)
  const snippet = clean.slice(sliceStart, sliceStart + 58).trim()
  return `${snippet}${snippet.length < clean.length ? '...' : ''}`
}

export async function generateDefaultShots(
  script: Script
): Promise<StoryboardShotDraft[]> {
  const supabase = getSupabaseServer()
  const { data: visualModes, error } = await supabase
    .from('layer_2_visual_modes')
    .select('slug,default_part_pairings,default_source_priority')
    .order('display_order', { ascending: true })

  if (error || !visualModes) {
    throw new Error(error?.message ?? 'Failed to fetch Layer 2 visual modes')
  }

  const partToVisualMode: Partial<Record<ScriptPartRole, VisualModeSlug>> = {}
  for (const role of SUPPORTED_PART_ROLES) {
    const matching = visualModes.find((mode) =>
      (mode.default_part_pairings ?? []).includes(role)
    )
    if (matching) partToVisualMode[role] = matching.slug as VisualModeSlug
  }

  const visualModeToSource: Partial<Record<VisualModeSlug, FootageSourceSlug>> = {}
  for (const mode of visualModes) {
    const sources = (mode.default_source_priority ?? []) as FootageSourceSlug[]
    const firstEnabled = sources.find((source) => source !== 'synthetic_host')
    if (firstEnabled) {
      visualModeToSource[mode.slug as VisualModeSlug] = firstEnabled
    }
  }

  const shots: StoryboardShotDraft[] = []
  let displayOrder = 0

  for (const part of script.parts) {
    if (!SUPPORTED_PART_ROLES.includes(part.role)) continue

    const shotCount = SHOTS_PER_PART[part.role] ?? 1
    const visualModeSlug = partToVisualMode[part.role] ?? 'talking_head'
    const footageSourceSlug = visualModeToSource[visualModeSlug] ?? 'live_shoot'
    const durationSeconds = Math.max(
      5,
      Math.round(estimatePartDurationSeconds(script, part) / shotCount)
    )

    for (let index = 0; index < shotCount; index += 1) {
      shots.push({
        scriptPartRole: part.role,
        displayOrder,
        partOrder: index,
        description: createDescription(part.content, index, shotCount),
        scriptExcerpt: createDescription(part.content, index, shotCount),
        visualInstruction: '按讀稿內容設計對應畫面。',
        visualModeSlug,
        footageSourceSlug,
        durationSeconds,
        generationStatus: 'pending',
      })
      displayOrder += 1
    }
  }

  return shots
}

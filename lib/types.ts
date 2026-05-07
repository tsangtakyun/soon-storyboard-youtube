export type FrameworkType = 'fern_6part' | 'custom'
export type HookVariant = 'mystery' | 'thesis' | 'trojan_horse'
export type ScriptTone = 'documentary' | 'explainer' | 'sharp_commentary'

export type ScriptPartRole =
  | 'hook'
  | 'setup'
  | 'detail'
  | 'complication'
  | 'depth'
  | 'resolution'
  | 'host_bite'
  | 'custom'

export type FootageSourceSlug =
  | 'live_shoot'
  | 'live_test'
  | 'internet'
  | 'stock'
  | 'ai_generation'
  | 'synthetic_host'

export type VisualModeSlug =
  | 'talking_head'
  | 'spatial_reconstruction'
  | 'archive_footage'
  | 'animation_diagram'
  | 'map_pull'
  | 'street_b_roll'
  | 'lyrical_imagery'
  | 'photo_document_pan'
  | 'data_viz'
  | 'verite'

export interface ScriptPart {
  id?: string
  role: ScriptPartRole
  roleLabel?: string
  order: number
  title?: string
  content: string
  hostBite?: string
  pivotSentence?: string
  estimatedDurationSeconds?: number
  durationRatio?: number
  wordCount?: number
}

export interface Script {
  id: string
  topic: string
  background?: string
  framework: FrameworkType
  hookVariant: HookVariant
  tone: ScriptTone
  targetMinutes: number
  outlineId?: string
  parts: ScriptPart[]
  pivotSentences?: Record<number, string>
  title?: string
  generatedAt: string
  model?: string
  storyboardId?: string
}

export interface VisualMode {
  slug: VisualModeSlug
  labelZh: string
  labelEn: string
  description: string
  displayOrder: number
}

export interface FootageSource {
  slug: FootageSourceSlug
  labelZh: string
  emoji: string
  description: string
  displayOrder: number
}

export interface StoryboardShot {
  id: string
  storyboardId: string
  scriptPartRole: ScriptPartRole
  displayOrder: number
  partOrder: number
  description: string
  visualModeSlug: VisualModeSlug
  footageSourceSlug: FootageSourceSlug
  durationSeconds?: number
  generationUrl?: string
  generationStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'
  generationMetadata?: Record<string, unknown>
  stockKeyword?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Storyboard {
  id: string
  scriptId: string
  title?: string
  status: 'draft' | 'in_progress' | 'completed'
  shots: StoryboardShot[]
  createdAt: string
  updatedAt: string
}

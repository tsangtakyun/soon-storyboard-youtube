import { buildDocRequests } from './drive-doc-builder'
import { GoogleOAuthAuthError, getValidAccessToken } from './google-oauth'
import { getSupabaseServer } from './supabase-server'
import { mapShotRow } from './storyboard-fetch'
import type { Script, Storyboard, StoryboardShot } from './types'

const DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents'

export interface DriveExportResult {
  docId: string
  docUrl: string
}

export async function exportStoryboardToDrive(
  storyboardId: string
): Promise<DriveExportResult> {
  const accessToken = await getValidAccessToken()
  if (!accessToken) throw new GoogleOAuthAuthError()

  const exportData = await fetchStoryboardForExport(storyboardId)
  const title = `${exportData.script.title ?? exportData.script.topic} - Storyboard`

  const createResponse = await fetch(DOCS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  const createData = await createResponse.json().catch(() => null)
  if (!createResponse.ok || !createData?.documentId) {
    throw new Error(
      `Doc create failed: ${JSON.stringify(createData) || createResponse.statusText}`
    )
  }

  const docId = createData.documentId as string
  const requests = buildDocRequests({
    script: exportData.script,
    storyboard: exportData.storyboard,
    shots: exportData.shots,
    labels: {
      visualModeLabels: exportData.visualModeLabels,
      footageSourceLabels: exportData.footageSourceLabels,
    },
  })

  const updateResponse = await fetch(`${DOCS_API_BASE}/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!updateResponse.ok) {
    const updateError = await updateResponse.text()
    throw new Error(`Doc update failed: ${updateError}`)
  }

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  }
}

async function fetchStoryboardForExport(storyboardId: string): Promise<{
  storyboard: Storyboard
  script: Script
  shots: StoryboardShot[]
  visualModeLabels: Map<string, string>
  footageSourceLabels: Map<string, { label: string; emoji?: string }>
}> {
  const supabase = getSupabaseServer()

  const { data: storyboardRow, error: storyboardError } = await supabase
    .from('storyboards')
    .select('*')
    .eq('id', storyboardId)
    .single()
  if (storyboardError || !storyboardRow) {
    throw new Error(storyboardError?.message ?? 'Storyboard not found')
  }

  const { data: scriptRow, error: scriptError } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', storyboardRow.script_id)
    .single()
  if (scriptError || !scriptRow) {
    throw new Error(scriptError?.message ?? 'Script not found')
  }

  const { data: shotRows, error: shotsError } = await supabase
    .from('storyboard_shots')
    .select('*')
    .eq('storyboard_id', storyboardId)
    .order('display_order', { ascending: true })
  if (shotsError) throw new Error(shotsError.message)

  const [{ data: visualModes }, { data: footageSources }] = await Promise.all([
    supabase.from('layer_2_visual_modes').select('slug,label_zh'),
    supabase.from('layer_2_footage_sources').select('slug,label_zh,emoji'),
  ])

  const shots = (shotRows ?? []).map(mapShotRow)
  const storyboard: Storyboard = {
    id: storyboardRow.id,
    scriptId: storyboardRow.script_id,
    title: storyboardRow.title ?? undefined,
    subjectReference: storyboardRow.subject_reference ?? undefined,
    status: storyboardRow.status,
    shots,
    createdAt: storyboardRow.created_at,
    updatedAt: storyboardRow.updated_at,
  }
  const script: Script = {
    id: scriptRow.id,
    topic: scriptRow.topic,
    background: scriptRow.background ?? undefined,
    framework: scriptRow.framework,
    hookVariant: scriptRow.hook_variant,
    tone: scriptRow.tone,
    targetMinutes: scriptRow.target_minutes,
    outlineId: scriptRow.outline_id ?? undefined,
    parts: scriptRow.parts ?? [],
    pivotSentences: scriptRow.pivot_sentences ?? undefined,
    title: scriptRow.title ?? undefined,
    generatedAt: scriptRow.generated_at ?? scriptRow.created_at,
    model: scriptRow.model ?? undefined,
    storyboardId: scriptRow.storyboard_id ?? undefined,
  }

  return {
    storyboard,
    script,
    shots,
    visualModeLabels: new Map(
      (visualModes ?? []).map((item) => [item.slug, item.label_zh])
    ),
    footageSourceLabels: new Map(
      (footageSources ?? []).map((item) => [
        item.slug,
        { label: item.label_zh, emoji: item.emoji ?? '' },
      ])
    ),
  }
}

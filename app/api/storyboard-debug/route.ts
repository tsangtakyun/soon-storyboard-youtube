import { NextResponse } from 'next/server'

import { getSupabaseServer } from '@/lib/supabase-server'

function getProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null

  try {
    return new URL(supabaseUrl).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
}

function serializeError(error: unknown) {
  if (!error || typeof error !== 'object') return null

  const err = error as {
    code?: string
    message?: string
    details?: string | null
    hint?: string | null
  }

  return {
    code: err.code ?? null,
    message: err.message ?? String(error),
    details: err.details ?? null,
    hint: err.hint ?? null,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const scriptId = url.searchParams.get('scriptId')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const env = {
    hasSupabaseUrl: Boolean(supabaseUrl),
    supabaseProjectRef: getProjectRef(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    serviceRoleKeyPrefix: serviceRoleKey?.slice(0, 9) ?? null,
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      success: false,
      env,
      error: 'Missing Supabase env',
    })
  }

  const supabase = getSupabaseServer()

  const { data: scriptsData, error: scriptsError } = await supabase
    .from('scripts')
    .select('id')
    .limit(1)

  const { data: storyboardsData, error: storyboardsError } = await supabase
    .from('storyboards')
    .select('id, script_id')
    .limit(1)

  const { data: shotsData, error: shotsError } = await supabase
    .from('storyboard_shots')
    .select('id, storyboard_id')
    .limit(1)

  const { count: visualModeCount, error: visualModesError } = await supabase
    .from('layer_2_visual_modes')
    .select('id', { count: 'exact', head: true })

  const { count: footageSourceCount, error: footageSourcesError } = await supabase
    .from('layer_2_footage_sources')
    .select('id', { count: 'exact', head: true })

  let scriptLookup = null
  let storyboardLookup = null
  if (scriptId) {
    const { data, error } = await supabase
      .from('scripts')
      .select('id, title, topic')
      .eq('id', scriptId)
      .maybeSingle()

    scriptLookup = {
      scriptId,
      found: Boolean(data),
      script: data ?? null,
      error: serializeError(error),
    }

    const { data: storyboard, error: storyboardError } = await supabase
      .from('storyboards')
      .select('id, script_id, title, status')
      .eq('script_id', scriptId)
      .maybeSingle()

    storyboardLookup = {
      found: Boolean(storyboard),
      storyboard: storyboard ?? null,
      error: serializeError(storyboardError),
    }
  }

  return NextResponse.json({
    success:
      !scriptsError &&
      !storyboardsError &&
      !shotsError &&
      !visualModesError &&
      !footageSourcesError &&
      (!scriptId || scriptLookup?.found),
    env,
    scriptsTableVisible: !scriptsError,
    storyboardsTableVisible: !storyboardsError,
    storyboardShotsTableVisible: !shotsError,
    scriptsSampleCount: scriptsData?.length ?? 0,
    storyboardsSampleCount: storyboardsData?.length ?? 0,
    storyboardShotsSampleCount: shotsData?.length ?? 0,
    visualModeCount,
    footageSourceCount,
    scriptLookup,
    storyboardLookup,
    errors: {
      scripts: serializeError(scriptsError),
      storyboards: serializeError(storyboardsError),
      storyboardShots: serializeError(shotsError),
      visualModes: serializeError(visualModesError),
      footageSources: serializeError(footageSourcesError),
    },
  })
}

import { notFound } from 'next/navigation'

import { StoryboardClient } from './StoryboardClient'
import { fetchFootageSources, fetchVisualModes } from '@/lib/layer-2-reader'
import {
  createStoryboard,
  fetchScript,
  fetchStoryboardByScriptId,
} from '@/lib/storyboard-fetch'

export const dynamic = 'force-dynamic'

function ErrorPanel({
  title,
  message,
  scriptId,
}: {
  title: string
  message: string
  scriptId: string
}) {
  return (
    <main style={{ minHeight: '100vh', padding: 24 }}>
      <section
        style={{
          border: '1px solid #ff8585',
          background: 'var(--panel)',
          borderRadius: 8,
          padding: 18,
          color: 'var(--ink)',
        }}
      >
        <p style={{ color: '#ffb5b5', marginTop: 0 }}>Storyboard 載入失敗</p>
        <h1>{title}</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{message}</p>
        <p style={{ color: 'var(--muted)' }}>
          Debug:{' '}
          <a href={`/api/storyboard-debug?scriptId=${scriptId}`}>
            /api/storyboard-debug?scriptId={scriptId}
          </a>
        </p>
      </section>
    </main>
  )
}

export default async function StoryboardPage({
  params,
}: {
  params: { scriptId: string }
}) {
  const script = await fetchScript(params.scriptId)
  if (!script) notFound()

  try {
    let storyboard = await fetchStoryboardByScriptId(params.scriptId)
    if (!storyboard) {
      await createStoryboard(params.scriptId)
      storyboard = await fetchStoryboardByScriptId(params.scriptId)
    }

    if (!storyboard) {
      return (
        <ErrorPanel
          title="已找到 script，但建立 storyboard 失敗"
          message="系統讀到 script，但未能建立或讀取 storyboard row。請打開 debug link 檢查 storyboards / storyboard_shots table 狀態。"
          scriptId={params.scriptId}
        />
      )
    }

    const [visualModes, footageSources] = await Promise.all([
      fetchVisualModes(),
      fetchFootageSources(),
    ])

    return (
      <StoryboardClient
        script={script}
        storyboard={storyboard}
        visualModes={visualModes}
        footageSources={footageSources}
      />
    )
  } catch (error) {
    return (
      <ErrorPanel
        title="Storyboard server error"
        message={error instanceof Error ? error.message : 'Unknown error'}
        scriptId={params.scriptId}
      />
    )
  }
}

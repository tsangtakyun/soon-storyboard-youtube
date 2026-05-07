import { notFound } from 'next/navigation'

import { fetchLayer2Options } from '@/lib/layer-2-reader'
import {
  createStoryboard,
  fetchScript,
  fetchStoryboardByScriptId,
} from '@/lib/storyboard-fetch'

export const dynamic = 'force-dynamic'

const pageStyle = {
  padding: '28px',
  display: 'grid',
  gap: '20px',
}

const panelStyle = {
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  borderRadius: '8px',
  padding: '20px',
}

export default async function StoryboardPage({
  params,
}: {
  params: { scriptId: string }
}) {
  const script = await fetchScript(params.scriptId)
  if (!script) notFound()

  let storyboard = await fetchStoryboardByScriptId(params.scriptId)
  if (!storyboard) {
    await createStoryboard(params.scriptId)
    storyboard = await fetchStoryboardByScriptId(params.scriptId)
  }

  const layer2 = await fetchLayer2Options()
  const visibleFootageSources = layer2.footageSources.filter(
    (source) => source.slug !== 'synthetic_host'
  )

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '0.08em' }}>
          STORYBOARD HANDOFF READY
        </p>
        <h1 style={{ margin: '8px 0 10px', fontSize: 30 }}>
          {script.title ?? script.topic}
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Script ID: <code>{script.id}</code>
        </p>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Storyboard ID: <code>{storyboard?.id ?? 'creating'}</code>
        </p>
      </section>

      <section style={panelStyle}>
        <h2>Script parts ({script.parts.length})</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {script.parts.map((part) => (
            <article
              key={`${part.order}-${part.role}`}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 14,
                background: 'rgba(255,255,255,0.035)',
              }}
            >
              <h3 style={{ margin: '0 0 8px' }}>
                {part.order + 1}. {part.roleLabel ?? part.role}
              </h3>
              <p style={{ color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>
                {part.content.slice(0, 260)}
                {part.content.length > 260 ? '...' : ''}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <h2>Storyboard ({storyboard?.shots.length ?? 0} shots)</h2>
        <p style={{ color: 'var(--muted)' }}>
          UI placeholder：Cycle 22 會加 shot list interactive UI。
        </p>
      </section>

      <section style={panelStyle}>
        <h2>Layer 2 options loaded</h2>
        <p style={{ color: 'var(--muted)' }}>
          Visual modes: {layer2.visualModes.length} · Footage sources:{' '}
          {visibleFootageSources.length} enabled / {layer2.footageSources.length} total
        </p>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          `synthetic_host` 已存在於資料層，但 Cycle 21 UI 暫時 disabled。
        </p>
      </section>
    </main>
  )
}

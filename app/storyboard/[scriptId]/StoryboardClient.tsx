'use client'

import { useMemo, useState } from 'react'

import { ShotList } from '@/components/ShotList'
import type {
  FootageSource,
  Script,
  ScriptPartRole,
  Storyboard,
  StoryboardShot,
  StoryboardShotUpdate,
  VisualMode,
} from '@/lib/types'

interface StoryboardClientProps {
  script: Script
  storyboard: Storyboard
  visualModes: VisualMode[]
  footageSources: FootageSource[]
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: 24,
  display: 'grid',
  gap: 18,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  borderRadius: 8,
  padding: 18,
}

const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(420px, 1.4fr)',
  gap: 18,
  alignItems: 'start',
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#26305a',
  color: 'var(--ink)',
  padding: '11px 14px',
  cursor: 'pointer',
}

function sortShots(shots: StoryboardShot[]) {
  return [...shots].sort((a, b) => a.displayOrder - b.displayOrder)
}

export function StoryboardClient({
  script,
  storyboard,
  visualModes,
  footageSources,
}: StoryboardClientProps) {
  const [shots, setShots] = useState<StoryboardShot[]>(sortShots(storyboard.shots))
  const [loading, setLoading] = useState(false)
  const [savingShotId, setSavingShotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enabledFootageSources = useMemo(
    () => footageSources.filter((source) => source.slug !== 'synthetic_host'),
    [footageSources]
  )

  const shotsByRole = useMemo(() => {
    const grouped = new Map<ScriptPartRole, StoryboardShot[]>()
    for (const shot of shots) {
      const current = grouped.get(shot.scriptPartRole) ?? []
      current.push(shot)
      grouped.set(shot.scriptPartRole, current)
    }
    for (const [role, roleShots] of grouped) {
      grouped.set(role, sortShots(roleShots))
    }
    return grouped
  }, [shots])

  async function refreshShots() {
    const res = await fetch(`/api/storyboards/${storyboard.id}/shots`)
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? '載入 shots 失敗')
    }
    setShots(sortShots(data.shots))
  }

  async function handleAIGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/generate-ai`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'AI 生成 storyboard 失敗')
      }
      setShots(sortShots(data.shots))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生成 storyboard 失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/seed`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? '生成初始 shots 失敗')
      }
      setShots(sortShots(data.shots))
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成初始 shots 失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddShot(role: ScriptPartRole) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptPartRole: role,
          visualModeSlug: visualModes[0]?.slug ?? 'talking_head',
          footageSourceSlug: enabledFootageSources[0]?.slug ?? 'live_shoot',
          description: '補充呢個 shot 要呈現嘅畫面。',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? '新增 shot 失敗')
      }
      setShots((current) => sortShots([...current, data.shot]))
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增 shot 失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteShot(shotId: string) {
    const original = shots
    setShots((current) => current.filter((shot) => shot.id !== shotId))
    try {
      const res = await fetch(`/api/shots/${shotId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? '刪除 shot 失敗')
      }
    } catch (err) {
      setShots(original)
      setError(err instanceof Error ? err.message : '刪除 shot 失敗')
    }
  }

  async function handleMoveShot(shotId: string, direction: 'up' | 'down') {
    setSavingShotId(shotId)
    setError(null)
    try {
      const res = await fetch(`/api/shots/${shotId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? '排序失敗')
      }
      await refreshShots()
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序失敗')
    } finally {
      setSavingShotId(null)
    }
  }

  function handleOptimisticUpdate(shotId: string, updates: StoryboardShotUpdate) {
    setSavingShotId(shotId)
    setShots((current) =>
      current.map((shot) => (shot.id === shotId ? { ...shot, ...updates } : shot))
    )
  }

  function handleServerUpdate(updatedShot: StoryboardShot) {
    setShots((current) =>
      sortShots(current.map((shot) => (shot.id === updatedShot.id ? updatedShot : shot)))
    )
    setSavingShotId(null)
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '0.08em' }}>
          SOON STORYBOARD
        </p>
        <h1 style={{ margin: '8px 0 10px', fontSize: 30 }}>
          {script.title ?? script.topic}
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Script ID: <code>{script.id}</code> · Storyboard ID:{' '}
          <code>{storyboard.id}</code>
        </p>
      </section>

      {error && (
        <section style={{ ...panelStyle, borderColor: '#ff8585', color: '#ffb5b5' }}>
          {error}
        </section>
      )}

      <div style={twoColumnStyle}>
        <aside style={{ ...panelStyle, position: 'sticky', top: 16 }}>
          <h2 style={{ marginTop: 0 }}>Script parts</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {script.parts.map((part) => (
              <article
                key={`${part.order}-${part.role}`}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
                  {part.order + 1}. {part.roleLabel ?? part.role}
                </h3>
                <p style={{ color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>
                  {part.content.slice(0, 220)}
                  {part.content.length > 220 ? '...' : ''}
                </p>
              </article>
            ))}
          </div>
        </aside>

        <section style={panelStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Storyboard</h2>
              <p style={{ color: 'var(--muted)', margin: '6px 0 0' }}>
                {shots.length} shots · Visual modes {visualModes.length} · Footage
                sources {footageSources.length}
              </p>
            </div>

            {shots.length === 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={handleAIGenerate}
                  disabled={loading}
                >
                  {loading ? 'AI 生成中（30-60 秒）...' : 'AI 生成 storyboard'}
                </button>
                <button
                  type="button"
                  style={{ ...buttonStyle, background: '#202842' }}
                  onClick={handleSeed}
                  disabled={loading}
                >
                  用 Layer 2 default 生成
                </button>
              </div>
            )}
          </div>

          {shots.length === 0 ? (
            <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              呢個 storyboard 暫時未有 shot。建議先用 AI 生成 content-aware
              storyboard；如果 Anthropic key 未設定，可以用 Layer 2 default fallback。
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              {script.parts.map((part) => (
                <ShotList
                  key={`${part.order}-${part.role}`}
                  part={part}
                  shots={shotsByRole.get(part.role) ?? []}
                  visualModes={visualModes}
                  footageSources={footageSources}
                  savingShotId={savingShotId}
                  onAddShot={handleAddShot}
                  onDeleteShot={handleDeleteShot}
                  onMoveShot={handleMoveShot}
                  onOptimisticUpdate={handleOptimisticUpdate}
                  onServerUpdate={handleServerUpdate}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

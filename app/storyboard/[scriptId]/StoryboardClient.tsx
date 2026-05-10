'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { ShotList } from '@/components/ShotList'
import type { HallucinatedShot } from '@/lib/script-coverage-validator'
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

interface CoverageReport {
  covered: boolean
  forwardCovered: boolean
  reverseCovered: boolean
  forwardRatio: number
  reverseRatio: number
  totalSentences: number
  totalShots: number
  missingSentences: string[]
  hallucinatedShots: HallucinatedShot[]
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

const PART_LABELS: Partial<Record<ScriptPartRole, string>> = {
  hook: 'Hook',
  setup: 'Setup',
  detail: 'Detail',
  complication: 'Complication',
  depth: 'Depth',
  resolution: 'Resolution',
}

function sortShots(shots: StoryboardShot[]) {
  return [...shots].sort((a, b) => a.displayOrder - b.displayOrder)
}

function formatCoverageError(data: any) {
  if (!data.coverage) return data.error ?? 'AI 生成 storyboard 失敗'

  const missing = data.coverage.missingSentences ?? []
  const hallucinated = data.coverage.hallucinatedShots ?? []
  const missingPreview = missing
    .slice(0, 5)
    .map((sentence: string, index: number) => `${index + 1}. ${sentence}`)
    .join('\n')
  const hallucinationPreview = hallucinated
    .slice(0, 5)
    .map(
      (shot: HallucinatedShot, index: number) =>
        `${index + 1}. Shot ${shot.shotIndex + 1}: ${shot.unmatchedPortion}`
    )
    .join('\n')

  return [
    'AI 生成失敗：script fidelity validation 未通過。',
    `Forward coverage: ${((data.coverage.forwardRatio ?? 0) * 100).toFixed(1)}%`,
    `Reverse coverage: ${((data.coverage.reverseRatio ?? 0) * 100).toFixed(1)}%`,
    '',
    missing.length > 0 ? `Missing sentences (${missing.length}):\n${missingPreview}` : '',
    hallucinated.length > 0
      ? `Hallucinated shots (${hallucinated.length}):\n${hallucinationPreview}`
      : '',
    '',
    '可以用 Layer 2 default fallback，或者重新嘗試生成呢個 part。',
  ]
    .filter(Boolean)
    .join('\n')
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
}

export function StoryboardClient({
  script,
  storyboard,
  visualModes,
  footageSources,
}: StoryboardClientProps) {
  const [shots, setShots] = useState<StoryboardShot[]>(sortShots(storyboard.shots))
  const [loading, setLoading] = useState(false)
  const [partRegenerating, setPartRegenerating] = useState<ScriptPartRole | null>(
    null
  )
  const [savingShotId, setSavingShotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<CoverageReport | null>(null)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [subjectReference, setSubjectReference] = useState(
    storyboard.subjectReference ?? ''
  )
  const [referenceStatus, setReferenceStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  )

  const enabledFootageSources = useMemo(
    () => footageSources.filter((source) => source.slug !== 'synthetic_host'),
    [footageSources]
  )

  const sortedShots = useMemo(() => sortShots(shots), [shots])

  const shotsByRole = useMemo(() => {
    const grouped = new Map<ScriptPartRole, StoryboardShot[]>()
    for (const shot of sortedShots) {
      const current = grouped.get(shot.scriptPartRole) ?? []
      current.push(shot)
      grouped.set(shot.scriptPartRole, current)
    }
    return grouped
  }, [sortedShots])

  const coverageKey = useMemo(
    () =>
      sortedShots
        .map(
          (shot) =>
            `${shot.id}:${shot.scriptExcerpt ?? shot.description}:${shot.displayOrder}`
        )
        .join('|'),
    [sortedShots]
  )

  const validationByShotId = useMemo(() => {
    const map = new Map<string, HallucinatedShot>()
    if (!coverage?.hallucinatedShots) return map

    for (const hallucination of coverage.hallucinatedShots) {
      const shotId = sortedShots[hallucination.shotIndex]?.id
      if (shotId) map.set(shotId, hallucination)
    }
    return map
  }, [coverage, sortedShots])

  useEffect(() => {
    if (shots.length === 0) {
      setCoverage(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/storyboards/${storyboard.id}/validate-coverage`,
          { method: 'POST', signal: controller.signal }
        )
        const data = await res.json()
        if (data.success) setCoverage(data)
      } catch {
        if (!controller.signal.aborted) setCoverage(null)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [coverageKey, shots.length, storyboard.id])

  function togglePart(order: number) {
    setExpandedParts((current) => {
      const next = new Set(current)
      if (next.has(order)) next.delete(order)
      else next.add(order)
      return next
    })
  }

  const debouncedSaveReference = useDebouncedCallback(async (value: string) => {
    setReferenceStatus('saving')
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_reference: value.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Subject reference 儲存失敗')
      }
      setReferenceStatus('saved')
      window.setTimeout(() => setReferenceStatus('idle'), 1200)
    } catch (err) {
      setReferenceStatus('idle')
      setError(err instanceof Error ? err.message : 'Subject reference 儲存失敗')
    }
  }, 1000)

  async function refreshShots() {
    const res = await fetch(`/api/storyboards/${storyboard.id}/shots`)
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? '讀取 shots 失敗')
    }
    setShots(sortShots(data.shots))
  }

  async function handleExportJSON() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/export-json`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Export JSON 失敗')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `storyboard-${safeFilename(script.title ?? script.topic)}-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export JSON 失敗')
    } finally {
      setExporting(false)
    }
  }

  async function handleAIGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/generate-ai`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.status === 422 && data.coverage) {
        throw new Error(formatCoverageError(data))
      }
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

  async function handlePartRegenerate(role: ScriptPartRole) {
    const label = PART_LABELS[role] ?? role
    const confirmed = window.confirm(
      `重新生成「${label}」？\n\n` +
        '呢個動作會刪除呢個 part 而家所有 shots，然後 AI 重新生成。\n' +
        '其他 part 嘅 shots 會保留。\n\n' +
        '生成需時約 10-30 秒。'
    )
    if (!confirmed) return

    setPartRegenerating(role)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/generate-ai-part`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptPartRole: role }),
      })
      const data = await res.json()
      if (res.status === 422 && data.coverage) {
        throw new Error(formatCoverageError(data))
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? '重新生成 part 失敗')
      }
      await refreshShots()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新生成 part 失敗')
      await refreshShots().catch(() => undefined)
    } finally {
      setPartRegenerating(null)
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
        throw new Error(data.error ?? '生成預設 shots 失敗')
      }
      setShots(sortShots(data.shots))
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成預設 shots 失敗')
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
          description: '新 storyboard shot',
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: '8px 0 10px', fontSize: 30 }}>
              {script.title ?? script.topic}
            </h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              Script ID: <code>{script.id}</code> · Storyboard ID:{' '}
              <code>{storyboard.id}</code>
            </p>
          </div>
          <button
            type="button"
            style={buttonStyle}
            onClick={handleExportJSON}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
        <div
          style={{
            marginTop: 16,
            borderTop: '1px solid var(--line)',
            paddingTop: 14,
            display: 'grid',
            gap: 8,
          }}
        >
          <label htmlFor="subject-reference" style={{ fontWeight: 700 }}>
            Subject reference
          </label>
          <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
            餐廳名、事件、人名、年份。Internet prompt 會用呢個做 Gemini search
            anchor。
          </p>
          <input
            id="subject-reference"
            type="text"
            value={subjectReference}
            placeholder="e.g. Jian Zao Ipoh Curry Noodle, Singapore"
            style={{
              border: '1px solid var(--line)',
              borderRadius: 6,
              background: '#fff',
              color: '#000',
              padding: '10px 12px',
              maxWidth: 720,
            }}
            onChange={(event) => {
              const value = event.target.value
              setSubjectReference(value)
              setReferenceStatus('saving')
              debouncedSaveReference(value)
            }}
          />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {referenceStatus === 'saving'
              ? 'Saving reference...'
              : referenceStatus === 'saved'
                ? 'Reference saved'
                : ' '}
          </span>
        </div>
      </section>

      {error && (
        <section
          style={{
            ...panelStyle,
            borderColor: '#ff8585',
            color: '#ffb5b5',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </section>
      )}

      <div style={twoColumnStyle}>
        <aside style={{ ...panelStyle, position: 'sticky', top: 16 }}>
          <h2 style={{ marginTop: 0 }}>Script parts</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {script.parts.map((part) => {
              const isExpanded = expandedParts.has(part.order)
              const shouldTruncate = part.content.length > 220
              const displayContent =
                isExpanded || !shouldTruncate
                  ? part.content
                  : `${part.content.slice(0, 220)}⋯`

              return (
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
                  <p
                    style={{
                      color: 'var(--muted)',
                      lineHeight: 1.55,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {displayContent}
                  </p>
                  {shouldTruncate && (
                    <button
                      type="button"
                      style={{ ...buttonStyle, marginTop: 10, padding: '8px 10px' }}
                      onClick={() => togglePart(part.order)}
                    >
                      {isExpanded ? '收起' : '展開全文'}
                    </button>
                  )}
                </article>
              )
            })}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Storyboard</h2>
                {coverage && (
                  <span
                    style={{
                      border: `1px solid ${coverage.covered ? '#58d68d' : '#ffb86b'}`,
                      color: coverage.covered ? '#8ff0b5' : '#ffd6a3',
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 12,
                    }}
                  >
                    {coverage.covered
                      ? 'Coverage 100%'
                      : `Coverage issue: missing ${coverage.missingSentences.length}, hallucinated ${coverage.hallucinatedShots.length}`}
                  </span>
                )}
              </div>
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
                  {loading ? 'AI 生成中 30-60 秒...' : 'AI 生成 storyboard'}
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
              呢個 storyboard 暫時未有 shot。可以用 AI 生成 content-aware storyboard，
              或用 Layer 2 default fallback。
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
                  partRegenerating={partRegenerating}
                  validationByShotId={validationByShotId}
                  onRegeneratePart={handlePartRegenerate}
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

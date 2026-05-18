'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
  background: '#0a0a0f',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  borderRadius: 12,
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
  borderRadius: 8,
  background: 'var(--surface2)',
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
    'AI 生成未通過 script fidelity validation。',
    `Forward coverage: ${((data.coverage.forwardRatio ?? 0) * 100).toFixed(1)}%`,
    `Reverse coverage: ${((data.coverage.reverseRatio ?? 0) * 100).toFixed(1)}%`,
    '',
    missing.length > 0 ? `Missing sentences (${missing.length}):\n${missingPreview}` : '',
    hallucinated.length > 0
      ? `Hallucinated shots (${hallucinated.length}):\n${hallucinationPreview}`
      : '',
    '',
    '你可以使用預設模板生成，或者逐個 part 重新生成。',
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
  const [driveExporting, setDriveExporting] = useState(false)
  const [driveDocUrl, setDriveDocUrl] = useState<string | null>(null)
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
        throw new Error(data.error ?? '主題參考儲存失敗')
      }
      setReferenceStatus('saved')
      window.setTimeout(() => setReferenceStatus('idle'), 1200)
    } catch (err) {
      setReferenceStatus('idle')
      setError(err instanceof Error ? err.message : '主題參考儲存失敗')
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

  async function handleDriveExport() {
    setDriveExporting(true)
    setDriveDocUrl(null)
    setError(null)
    try {
      const res = await fetch(`/api/storyboards/${storyboard.id}/export-drive`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.status === 401 && data.needsAuth) {
        const returnTo = encodeURIComponent(window.location.pathname)
        window.location.href = `/api/auth/google?returnTo=${returnTo}`
        return
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Drive export failed')
      }

      setDriveDocUrl(data.docUrl)
      window.open(data.docUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drive export failed')
    } finally {
      setDriveExporting(false)
    }
  }

  function handlePushToProduction() {
    window.parent.postMessage(
      {
        type: 'SOON_NAVIGATE_TOOL',
        pipeline: 'youtube',
        tool: 'production',
        scriptId: script.id,
        topic: script.topic || '',
        title: script.title || '',
      },
      '*'
    )
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
        throw new Error(data.error ?? '建立預設 shots 失敗')
      }
      setShots(sortShots(data.shots))
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立預設 shots 失敗')
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
          description: '新增 storyboard shot',
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
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 12, color: '#5a5a72', margin: '0 0 4px' }}>
              SOON 創作工作台
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f5', margin: 0 }}>
              {script.title || script.topic || 'YouTube 分鏡工作台'}
            </h1>
            <p style={{ fontSize: 13, color: '#9090a8', margin: '4px 0 0' }}>
              選擇每段拍攝方法，完成後推去製作清單
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={exporting}
              style={{
                background: 'transparent',
                border: '1px solid #2a2a3a',
                color: '#9090a8',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}
            >
              📦 {exporting ? 'Exporting...' : 'Export JSON'}
            </button>
            <button
              type="button"
              onClick={handleDriveExport}
              disabled={driveExporting}
              style={{
                background: 'transparent',
                border: '1px solid #0ea5e9',
                color: '#0ea5e9',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                cursor: driveExporting ? 'not-allowed' : 'pointer',
              }}
            >
              ☁️ {driveExporting ? 'Exporting...' : 'Drive Doc'}
            </button>
            <button
              type="button"
              onClick={handlePushToProduction}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              🎬 推去製作清單
            </button>
          </div>
        </div>

        <div
          style={{
            width: '100%',
            height: 120,
            background:
              'linear-gradient(135deg, #0d0d1a 0%, #1a1030 40%, #0a1628 100%)',
            borderRadius: 12,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 30% 50%, rgba(124,92,252,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(16,185,129,0.1) 0%, transparent 60%)',
            }}
          />
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.2em',
              fontWeight: 500,
              position: 'relative',
            }}
          >
            YOUTUBE STORYBOARD
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {['題材工作台', '劇本工作台', '分鏡工作台'].map((label, index) => (
            <Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: index === 2 ? '#7c5cfc' : 'transparent',
                    border: index === 2 ? 'none' : '1px solid #3a3a50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: index === 2 ? 'white' : '#5a5a72',
                    fontWeight: index === 2 ? 600 : 400,
                  }}
                >
                  {index + 1}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: index === 2 ? '#f0f0f5' : '#5a5a72',
                    fontWeight: index === 2 ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
              {index < 2 && <div style={{ flex: 1, height: 1, background: '#2a2a3a' }} />}
            </Fragment>
          ))}
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: 8 }}>
          <label htmlFor="subject-reference" style={{ fontWeight: 700 }}>
            主題參考
          </label>
          <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
            提供餐廳、事件、人名或年份等搜尋線索，AI 會用作生成分鏡時嘅參考。
          </p>
          <input
            id="subject-reference"
            type="text"
            value={subjectReference}
            placeholder="例：餐廳名、事件、人名、年份（AI 會用呢個做搜尋參考）"
            style={{
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: '#111118',
              color: '#f0f0f5',
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
              ? '儲存中...'
              : referenceStatus === 'saved'
                ? '已儲存'
                : ' '}
          </span>
          {driveDocUrl && (
            <a
              href={driveDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', fontSize: 12 }}
            >
              開啟最新 Drive 文件
            </a>
          )}
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
          <h2 style={{ marginTop: 0 }}>劇本段落</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {script.parts.map((part) => {
              const isExpanded = expandedParts.has(part.order)
              const shouldTruncate = part.content.length > 220
              const displayContent =
                isExpanded || !shouldTruncate
                  ? part.content
                  : `${part.content.slice(0, 220)}...`

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
                      {isExpanded ? '收合' : '展開全文'}
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
                <h2 style={{ margin: 0 }}>分鏡板</h2>
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
                {shots.length} 個鏡頭 · {visualModes.length} 個拍攝模式 ·{' '}
                {footageSources.length} 個素材來源
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
                  {loading ? 'AI 生成中，約 30-60 秒...' : 'AI 生成 storyboard'}
                </button>
                <button
                  type="button"
                  style={{ ...buttonStyle, background: '#202842' }}
                  onClick={handleSeed}
                  disabled={loading}
                >
                  預設模板生成
                </button>
              </div>
            )}
          </div>

          {shots.length === 0 ? (
            <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              未有 storyboard shots。你可以使用 AI 生成內容感知分鏡，或者先用預設模板建立基本分鏡。
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

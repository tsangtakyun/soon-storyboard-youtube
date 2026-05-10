'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import type {
  FootageSource,
  StoryboardShot,
  StoryboardShotUpdate,
  VisualMode,
} from '@/lib/types'

interface ShotValidation {
  isHallucinated: boolean
  matchedPortion?: string
  unmatchedPortion?: string
}

interface ShotCardProps {
  shot: StoryboardShot
  validation?: ShotValidation
  visualModes: VisualMode[]
  footageSources: FootageSource[]
  canMoveUp: boolean
  canMoveDown: boolean
  onOptimisticUpdate: (shotId: string, updates: StoryboardShotUpdate) => void
  onServerUpdate: (shot: StoryboardShot) => void
  onDelete: (shotId: string) => void
  onMove: (shotId: string, direction: 'up' | 'down') => void
  saving: boolean
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.035)',
  padding: 14,
  display: 'grid',
  gap: 12,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 76,
  resize: 'vertical',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#0d1220',
  color: 'var(--ink)',
  padding: 10,
  lineHeight: 1.5,
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  color: '#000',
  padding: '9px 10px',
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#202842',
  color: 'var(--ink)',
  padding: '8px 10px',
  cursor: 'pointer',
}

async function patchShot(shotId: string, updates: StoryboardShotUpdate) {
  const res = await fetch(`/api/shots/${shotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? '更新 shot 失敗')
  }
  return data.shot as StoryboardShot
}

export function ShotCard({
  shot,
  validation,
  visualModes,
  footageSources,
  canMoveUp,
  canMoveDown,
  onOptimisticUpdate,
  onServerUpdate,
  onDelete,
  onMove,
  saving,
}: ShotCardProps) {
  const [scriptExcerpt, setScriptExcerpt] = useState(
    shot.scriptExcerpt ?? shot.description
  )
  const [visualInstruction, setVisualInstruction] = useState(
    shot.visualInstruction ?? ''
  )
  const [notes, setNotes] = useState(shot.notes ?? '')
  const [productionPrompt, setProductionPrompt] = useState(
    shot.productionPrompt ?? ''
  )
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [error, setError] = useState<string | null>(null)

  const currentFootageSource = useMemo(
    () => footageSources.find((source) => source.slug === shot.footageSourceSlug),
    [footageSources, shot.footageSourceSlug]
  )

  const isPromptDisabled =
    !currentFootageSource?.productionPromptTemplate ||
    currentFootageSource.slug === 'synthetic_host'
  const isPromptStale =
    !!shot.productionPromptForSource &&
    shot.productionPromptForSource !== shot.footageSourceSlug

  useEffect(() => {
    setScriptExcerpt(shot.scriptExcerpt ?? shot.description)
    setVisualInstruction(shot.visualInstruction ?? '')
    setNotes(shot.notes ?? '')
    setProductionPrompt(shot.productionPrompt ?? '')
  }, [
    shot.description,
    shot.notes,
    shot.productionPrompt,
    shot.scriptExcerpt,
    shot.visualInstruction,
  ])

  const debouncedSave = useDebouncedCallback(
    async (shotId: string, updates: StoryboardShotUpdate) => {
      try {
        setError(null)
        const updated = await patchShot(shotId, updates)
        onServerUpdate(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : '自動儲存失敗')
      }
    },
    1000
  )

  async function handleImmediateSave(updates: StoryboardShotUpdate) {
    onOptimisticUpdate(shot.id, updates)
    try {
      setError(null)
      const updated = await patchShot(shot.id, updates)
      onServerUpdate(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    }
  }

  async function handleGeneratePrompt() {
    if (isPromptDisabled) return

    setGeneratingPrompt(true)
    setError(null)
    try {
      const res = await fetch(`/api/shots/${shot.id}/generate-prompt`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Production prompt 生成失敗')
      }
      onServerUpdate(data.shot)
      setProductionPrompt(data.shot.productionPrompt ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Production prompt 生成失敗')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  async function handleCopyPrompt() {
    if (!productionPrompt) return
    await navigator.clipboard.writeText(productionPrompt)
    setCopyState('copied')
    window.setTimeout(() => setCopyState('idle'), 1200)
  }

  return (
    <article style={cardStyle}>
      {validation?.isHallucinated && (
        <div
          style={{
            border: '1px solid #ff8585',
            background: 'rgba(255,80,80,0.12)',
            color: '#ffd0d0',
            borderRadius: 8,
            padding: 10,
            lineHeight: 1.55,
          }}
        >
          <strong>此 shot 嘅讀稿原文含有 script 入面不存在嘅內容</strong>
          <details style={{ marginTop: 6 }}>
            <summary>查看 detail</summary>
            <p style={{ marginBottom: 6 }}>
              Matched: {validation.matchedPortion || '無可匹配內容'}
            </p>
            <p style={{ margin: 0 }}>
              Hallucinated: {validation.unmatchedPortion || '未能定位'}
            </p>
          </details>
        </div>
      )}

      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <strong>Shot {shot.displayOrder + 1}</strong>
        <div style={rowStyle}>
          {saving && <span style={{ color: 'var(--muted)' }}>儲存中...</span>}
          <button
            type="button"
            style={buttonStyle}
            disabled={!canMoveUp}
            onClick={() => onMove(shot.id, 'up')}
            title="上移"
          >
            ↑
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={!canMoveDown}
            onClick={() => onMove(shot.id, 'down')}
            title="下移"
          >
            ↓
          </button>
          <button
            type="button"
            style={{ ...buttonStyle, color: '#ffb5b5' }}
            onClick={() => onDelete(shot.id)}
          >
            刪除
          </button>
        </div>
      </div>

      <label>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>讀稿原文</span>
        <textarea
          style={textareaStyle}
          value={scriptExcerpt}
          onChange={(event) => {
            const value = event.target.value
            setScriptExcerpt(value)
            onOptimisticUpdate(shot.id, {
              scriptExcerpt: value,
              description: value,
            })
            debouncedSave(shot.id, { scriptExcerpt: value, description: value })
          }}
        />
      </label>

      <label>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          鏡頭 instruction
        </span>
        <textarea
          style={textareaStyle}
          value={visualInstruction}
          placeholder="例如：Medium shot 主持坐 studio sofa, eye-level, warm lighting"
          onChange={(event) => {
            const value = event.target.value
            setVisualInstruction(value)
            onOptimisticUpdate(shot.id, { visualInstruction: value })
            debouncedSave(shot.id, { visualInstruction: value })
          }}
        />
      </label>

      <div style={rowStyle}>
        <label>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Visual mode</span>
          <br />
          <select
            style={inputStyle}
            value={shot.visualModeSlug}
            onChange={(event) =>
              handleImmediateSave({
                visualModeSlug: event.target
                  .value as StoryboardShot['visualModeSlug'],
              })
            }
          >
            {visualModes.map((mode) => (
              <option key={mode.slug} value={mode.slug}>
                {mode.labelZh} / {mode.labelEn}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            Footage source
          </span>
          <br />
          <select
            style={inputStyle}
            value={shot.footageSourceSlug}
            onChange={(event) =>
              handleImmediateSave({
                footageSourceSlug: event.target
                  .value as StoryboardShot['footageSourceSlug'],
              })
            }
          >
            {footageSources.map((source) => (
              <option
                key={source.slug}
                value={source.slug}
                disabled={source.slug === 'synthetic_host'}
              >
                {source.emoji} {source.labelZh}
                {source.slug === 'synthetic_host' ? ' (Coming soon)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>秒數</span>
          <br />
          <input
            style={{ ...inputStyle, width: 90 }}
            type="number"
            min={0}
            value={shot.durationSeconds ?? ''}
            onChange={(event) =>
              handleImmediateSave({
                durationSeconds:
                  event.target.value === '' ? null : Number(event.target.value),
              })
            }
          />
        </label>
      </div>

      {shot.contentTypeSlug && (
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Content type: <code>{shot.contentTypeSlug}</code>
        </p>
      )}

      <label>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>備註</span>
        <textarea
          style={{ ...textareaStyle, minHeight: 54 }}
          value={notes}
          onChange={(event) => {
            const value = event.target.value
            setNotes(value)
            onOptimisticUpdate(shot.id, { notes: value })
            debouncedSave(shot.id, { notes: value })
          }}
        />
      </label>

      <section
        style={{
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 12,
          display: 'grid',
          gap: 10,
          background: 'rgba(255,255,255,0.025)',
        }}
      >
        <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
          <strong>Production Prompt</strong>
          <div style={rowStyle}>
            <button
              type="button"
              style={buttonStyle}
              disabled={generatingPrompt || isPromptDisabled}
              onClick={handleGeneratePrompt}
            >
              {generatingPrompt
                ? '生成中...'
                : productionPrompt
                  ? '重新生成'
                  : currentFootageSource?.productionPromptLabel ?? '生成 prompt'}
            </button>
            {productionPrompt && (
              <button type="button" style={buttonStyle} onClick={handleCopyPrompt}>
                {copyState === 'copied' ? '已 copy' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        {isPromptDisabled && (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            呢個 footage source 暫時未有 production prompt template。
          </p>
        )}

        {isPromptStale && (
          <div
            style={{
              border: '1px solid #ffb86b',
              background: 'rgba(255,184,107,0.12)',
              color: '#ffd6a3',
              borderRadius: 8,
              padding: 10,
            }}
          >
            Footage source 已由 {shot.productionPromptForSource} 改成{' '}
            {shot.footageSourceSlug}，呢段 prompt 可能已過時，建議重新生成。
          </div>
        )}

        {productionPrompt ? (
          <textarea
            style={{ ...textareaStyle, minHeight: 160 }}
            value={productionPrompt}
            onChange={(event) => {
              const value = event.target.value
              setProductionPrompt(value)
              onOptimisticUpdate(shot.id, { productionPrompt: value })
              debouncedSave(shot.id, { productionPrompt: value })
            }}
          />
        ) : (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            撳上面 button，按 footage source 生成下一步 production prompt。
          </p>
        )}
      </section>

      {error && <p style={{ color: '#ffb5b5', margin: 0 }}>{error}</p>}
    </article>
  )
}

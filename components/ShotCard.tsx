'use client'

import { useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import type {
  FootageSource,
  StoryboardShot,
  StoryboardShotUpdate,
  VisualMode,
} from '@/lib/types'

interface ShotCardProps {
  shot: StoryboardShot
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
  gap: 10,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 78,
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
  const [description, setDescription] = useState(shot.description)
  const [notes, setNotes] = useState(shot.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDescription(shot.description)
    setNotes(shot.notes ?? '')
  }, [shot.description, shot.notes])

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

  return (
    <article style={cardStyle}>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <strong>Shot {shot.displayOrder + 1}</strong>
        <div style={rowStyle}>
          {saving && <span style={{ color: 'var(--muted)' }}>儲存中</span>}
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
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>畫面描述</span>
        <textarea
          style={textareaStyle}
          value={description}
          onChange={(event) => {
            const value = event.target.value
            setDescription(value)
            onOptimisticUpdate(shot.id, { description: value })
            debouncedSave(shot.id, { description: value })
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
                visualModeSlug: event.target.value as StoryboardShot['visualModeSlug'],
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
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Footage source</span>
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

      {error && <p style={{ color: '#ffb5b5', margin: 0 }}>{error}</p>}
    </article>
  )
}

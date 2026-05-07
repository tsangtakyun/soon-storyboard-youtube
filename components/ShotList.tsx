'use client'

import { ShotCard } from './ShotCard'
import type {
  FootageSource,
  ScriptPart,
  ScriptPartRole,
  StoryboardShot,
  StoryboardShotUpdate,
  VisualMode,
} from '@/lib/types'

interface ShotListProps {
  part: ScriptPart
  shots: StoryboardShot[]
  visualModes: VisualMode[]
  footageSources: FootageSource[]
  savingShotId: string | null
  onAddShot: (role: ScriptPartRole) => void
  onDeleteShot: (shotId: string) => void
  onMoveShot: (shotId: string, direction: 'up' | 'down') => void
  onOptimisticUpdate: (shotId: string, updates: StoryboardShotUpdate) => void
  onServerUpdate: (shot: StoryboardShot) => void
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 14,
  background: 'rgba(255,255,255,0.025)',
  display: 'grid',
  gap: 12,
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#202842',
  color: 'var(--ink)',
  padding: '10px 12px',
  cursor: 'pointer',
}

export function ShotList({
  part,
  shots,
  visualModes,
  footageSources,
  savingShotId,
  onAddShot,
  onDeleteShot,
  onMoveShot,
  onOptimisticUpdate,
  onServerUpdate,
}: ShotListProps) {
  return (
    <section style={sectionStyle}>
      <div>
        <h3 style={{ margin: 0 }}>
          {part.order + 1}. {part.roleLabel ?? part.role}
        </h3>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
          {shots.length} shots
        </p>
      </div>

      {shots.length === 0 ? (
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          呢個 part 暫時未有 shot。
        </p>
      ) : (
        shots.map((shot, index) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            visualModes={visualModes}
            footageSources={footageSources}
            canMoveUp={index > 0}
            canMoveDown={index < shots.length - 1}
            saving={savingShotId === shot.id}
            onOptimisticUpdate={onOptimisticUpdate}
            onServerUpdate={onServerUpdate}
            onDelete={onDeleteShot}
            onMove={onMoveShot}
          />
        ))
      )}

      <button type="button" style={buttonStyle} onClick={() => onAddShot(part.role)}>
        + 加 shot 喺呢個 part
      </button>
    </section>
  )
}

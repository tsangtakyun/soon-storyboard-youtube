'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const pageStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  padding: '48px 20px',
}

const panelStyle: React.CSSProperties = {
  width: 'min(760px, 100%)',
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  borderRadius: 8,
  padding: 28,
  display: 'grid',
  gap: 18,
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  color: '#000',
  padding: 10,
}

export default function LandingPage() {
  const router = useRouter()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const scriptId = params.get('scriptId')
    if (scriptId) {
      const embeddedQuery = params.get('embedded') === 'true' ? '?embedded=true' : ''
      router.push(`/storyboard/${scriptId}${embeddedQuery}`)
    }
  }, [router])

  async function handleImportFile(file: File) {
    setImporting(true)
    setError(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/storyboards/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Import failed')
      }
      router.push(`/storyboard/${data.newScriptId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import JSON 失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div className="soon-hide-embedded">
          <p
            style={{
              color: 'var(--accent)',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            SOON STORYBOARD YOUTUBE
          </p>
          <h1 style={{ margin: '8px 0 12px', fontSize: 34 }}>
            等 script handoff
          </h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            由 SOON Script Generator 撳「Continue → Storyboard」開始。亦可以
            import 之前 export 出嚟嘅 storyboard JSON。
          </p>
        </div>

        <section
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: 18,
            display: 'grid',
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>Import Storyboard JSON</h2>
          <input
            style={inputStyle}
            type="file"
            accept=".json,application/json"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleImportFile(file)
            }}
          />
          {importing && <p style={{ color: 'var(--muted)' }}>處理中...</p>}
          {error && <p style={{ color: '#ffb5b5' }}>{error}</p>}
        </section>
      </section>
    </main>
  )
}

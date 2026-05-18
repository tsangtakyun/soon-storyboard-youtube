'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const pageStyle: React.CSSProperties = {
  display: 'grid',
  minHeight: '100vh',
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
  gap: 14,
  textAlign: 'center',
}

export default function StoryboardFallbackPage() {
  const router = useRouter()
  const [isEmbedded, setIsEmbedded] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const scriptId = params.get('scriptId')
    const embedded = params.get('embedded') === 'true'
    setIsEmbedded(embedded)

    if (scriptId) {
      router.replace(`/storyboard/${scriptId}${embedded ? '?embedded=true' : ''}`)
      return
    }

    if (!embedded) {
      router.replace('/')
    }
  }, [router])

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p
          style={{
            color: 'var(--accent)',
            fontSize: 12,
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          SOON YOUTUBE STORYBOARD
        </p>
        <h1 style={{ margin: 0, fontSize: 28 }}>未有劇本可建立分鏡</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
          請先喺 YouTube 劇本工作台生成劇本，再按「推去分鏡」。系統會帶同劇本 ID 自動開啟分鏡編輯頁。
        </p>
        {isEmbedded && (
          <button
            type="button"
            onClick={() => {
              window.parent.postMessage(
                {
                  type: 'SOON_NAVIGATE_TOOL',
                  pipeline: 'youtube',
                  tool: 'script',
                },
                '*'
              )
            }}
            style={{
              margin: '8px auto 0',
              border: 0,
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 18px',
            }}
          >
            返回 YouTube 劇本工作台
          </button>
        )}
      </section>
    </main>
  )
}

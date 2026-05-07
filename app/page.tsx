const pageStyle = {
  display: 'grid',
  placeItems: 'center',
  padding: '48px 20px',
}

const panelStyle = {
  width: 'min(760px, 100%)',
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  borderRadius: '8px',
  padding: '28px',
}

export default function LandingPage() {
  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '0.08em' }}>
          SOON STORYBOARD YOUTUBE
        </p>
        <h1 style={{ margin: '8px 0 12px', fontSize: 34 }}>等 script handoff</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          呢個工具由 SOON Script Generator 撳「Continue → Storyboard」開始。
          直接打開首頁只會見到呢個 placeholder。
        </p>
      </section>
    </main>
  )
}

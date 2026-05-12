import './globals.css'
import type { Metadata } from 'next'

import { EmbeddedMode } from '@/components/EmbeddedMode'

export const metadata: Metadata = {
  title: 'SOON Storyboard YouTube',
  description: 'SOON YouTube storyboard planning tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="stylesheet" href="/soon-design-system.css" />
      </head>
      <body>
        <EmbeddedMode />
        {children}
      </body>
    </html>
  )
}

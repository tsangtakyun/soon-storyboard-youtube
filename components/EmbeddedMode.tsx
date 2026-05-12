'use client'

import { useEffect } from 'react'

export function EmbeddedMode() {
  useEffect(() => {
    const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === 'true'
    document.body.classList.toggle('embedded', isEmbedded)

    return () => {
      document.body.classList.remove('embedded')
    }
  }, [])

  return null
}

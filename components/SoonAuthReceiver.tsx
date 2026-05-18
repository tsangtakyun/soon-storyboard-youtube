'use client'

import { useEffect } from 'react'

import { getSupabaseClient } from '@/lib/supabase-client'

export function SoonAuthReceiver() {
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_AUTH') return

      const { accessToken, refreshToken } = event.data
      if (!accessToken || !refreshToken) return

      try {
        const supabase = getSupabaseClient()
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      } catch (error) {
        console.error('[SOON_AUTH] Failed to set storyboard session:', error)
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return null
}

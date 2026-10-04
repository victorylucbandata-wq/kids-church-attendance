'use client'

import { useEffect } from 'react'

export const LAST_CHURCH_KEY = 'kids-checkin-church'

// Remembers this phone's church so the home page can skip the church picker next time.
export default function RememberChurch({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(LAST_CHURCH_KEY, slug)
    } catch {
      // Private mode or storage blocked: the picker just shows again next time.
    }
  }, [slug])
  return null
}

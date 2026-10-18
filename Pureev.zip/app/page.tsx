'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function HomePage() {
  useEffect(() => {
    window.location.replace('/dashboard')
  }, [])

  return <main><p>Opening the dashboard… <Link href="/dashboard">Continue</Link></p></main>
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      // If user is logged in, redirect to dashboard
      if (session) {
        router.push('/dashboard')
      } else {
        // Otherwise, redirect to the landing page
        // We'll use a static route for the landing page
        window.location.href = '/landing-page/index.html'
      }
    }

    checkSession()
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center">
      {isLoading && <div className="text-xl">Loading...</div>}
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email ?? '')
      setLoading(false)
    }

    getUser()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-orange-500">SafetyEd QLD</h1>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Welcome back</h2>
          <p className="text-gray-400">Logged in as: <span className="text-white">{email}</span></p>
          <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400 text-sm">Auth is working. Supabase is connected.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
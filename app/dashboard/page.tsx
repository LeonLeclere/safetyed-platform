'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  first_name: string
  last_name: string
  school_id: string
}

interface School {
  name: string
}

export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [classCode, setClassCode] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrollMessage, setEnrollMessage] = useState('')
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

  async function handleEnrol() {
    if (!classCode.trim()) return
    setEnrolling(true)
    setEnrollMessage('')

    const { data: school, error } = await supabase
      .from('schools')
      .select('id, name')
      .eq('school_code', classCode.toUpperCase())
      .single()

    if (error || !school) {
      setEnrollMessage('Invalid code. Check with your teacher.')
      setEnrolling(false)
      return
    }

    setEnrollMessage(`Found: ${school.name}. Enrolment coming soon.`)
    setEnrolling(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3f0' }}>
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div style={{ background: '#f4f3f0', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
      {/* Import fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');`}</style>

      {/* Top Nav */}
      <nav style={{ background: '#1a1a1c', height: '56px', display: 'flex', alignItems: 'center', padding: '0 28px', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          Safety<span style={{ color: '#f97316' }}>Ed</span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          Student Portal
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#000' }}>
            {initials}
          </div>
          <button onClick={handleLogout} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page Body */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '30px', fontWeight: 700 }}>
            My Training
          </div>
          <div style={{ fontSize: '14px', color: '#71717a', marginTop: '3px' }}>
            {email}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Modules Completed', value: '0', color: '#16a34a' },
            { label: 'In Progress', value: '0', color: '#f97316' },
            { label: 'Waivers Issued', value: '0', color: '#2563eb' },
            { label: 'Classes Enrolled', value: '0', color: '#1a1a1c' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e4e4e0', borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{stat.label}</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Enrol Card */}
        <div style={{ background: '#1a1a1c', color: '#fff', borderRadius: '12px', padding: '20px 22px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Join a Class</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '16px' }}>Enter the class code from your teacher</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="Class code e.g. BG9X2K"
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '11px 14px', color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', outline: 'none' }}
            />
            <button
              onClick={handleEnrol}
              disabled={enrolling}
              style={{ padding: '11px 22px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#000', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {enrolling ? 'Checking...' : 'Join Class'}
            </button>
          </div>
          {enrollMessage && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: enrollMessage.includes('Invalid') ? '#f87171' : '#86efac' }}>
              {enrollMessage}
            </div>
          )}
        </div>

        {/* Modules Section */}
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a', marginBottom: '12px' }}>
          My Modules
        </div>

        {/* Empty State */}
        <div style={{ background: '#fff', border: '1.5px dashed #d0cfcb', borderRadius: '12px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#71717a', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 300 }}>+</div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>No modules yet</div>
          <div style={{ fontSize: '12px' }}>Join a class above to get started</div>
        </div>

      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type Module = {
  id: string
  name: string
  machine_key: string
  subject: string
  estimated_minutes: number
  section_count: number
}

type EnrolledClass = {
  id: string
  name: string
  subject: string
  modules: Module[]
}

export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [classCode, setClassCode] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrollMessage, setEnrollMessage] = useState('')
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([])
  const [completedModules, setCompletedModules] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? '')
      setUserId(user.id)
      await loadEnrolments(user.id)
      await loadCompletions(user.id)
      setLoading(false)
    }
    init()
  }, [router])

  async function loadEnrolments(uid: string) {
    // Get all classes this student is enrolled in
    const { data: enrolments, error } = await supabase
      .from('enrolments')
      .select('class_id')
      .eq('student_id', uid)

    if (error || !enrolments || enrolments.length === 0) return

    const classIds = enrolments.map(e => e.class_id)

    // Get class details
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, name, subject')
      .in('id', classIds)

    if (classError || !classes) return

    // Get modules for each class
    const classesWithModules: EnrolledClass[] = []

    for (const cls of classes) {
      const { data: classModules } = await supabase
        .from('class_modules')
        .select('sort_order, module:modules(id, name, machine_key, subject, estimated_minutes, section_count)')
        .eq('class_id', cls.id)
        .order('sort_order')

      const modules: Module[] = (classModules ?? [])
        .map((cm: any) => cm.module)
        .filter(Boolean)

      classesWithModules.push({
        id: cls.id,
        name: cls.name,
        subject: cls.subject,
        modules,
      })
    }

    setEnrolledClasses(classesWithModules)
  }

  async function loadCompletions(uid: string) {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('module_id')
      .eq('student_id', uid)
      .eq('passed', true)

    if (attempts) {
      setCompletedModules(attempts.map(a => a.module_id))
    }
  }

  async function handleEnrol() {
    if (!classCode.trim()) return
    setEnrolling(true)
    setEnrollMessage('')

    const code = classCode.trim().toUpperCase()

    // Find the class by join code
    const { data: cls, error } = await supabase
      .from('classes')
      .select('id, name, subject')
      .eq('join_code', code)
      .eq('active', true)
      .single()

    if (error || !cls) {
      setEnrollMessage('Invalid code. Check with your teacher.')
      setEnrolling(false)
      return
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrolments')
      .select('id')
      .eq('student_id', userId)
      .eq('class_id', cls.id)
      .single()

    if (existing) {
      setEnrollMessage('You are already enrolled in this class.')
      setEnrolling(false)
      return
    }

    // Enrol the student
    const { error: enrolError } = await supabase
      .from('enrolments')
      .insert({ student_id: userId, class_id: cls.id })

    if (enrolError) {
      setEnrollMessage('Something went wrong. Try again.')
      setEnrolling(false)
      return
    }

    setEnrollMessage(`Enrolled in ${cls.name}!`)
    setClassCode('')
    setEnrolling(false)

    // Reload enrolments
    await loadEnrolments(userId)
  }

  function getModuleUrl(machineKey: string): string {
    const map: Record<string, string> = {
      'knife': '/modules/kitchen-knives.html',
      'bandsaw': '/modules/bandsaw.html',
    }
    return map[machineKey] ?? '#'
  }

  function getModuleIcon(subject: string): string {
    if (subject.toLowerCase().includes('food')) return '🍽️'
    if (subject.toLowerCase().includes('wood')) return '🪚'
    if (subject.toLowerCase().includes('metal')) return '⚙️'
    return '📋'
  }

  // Flatten all modules across all classes (deduplicated by id)
  const allModules: Module[] = []
  const seen = new Set<string>()
  for (const cls of enrolledClasses) {
    for (const mod of cls.modules) {
      if (!seen.has(mod.id)) {
        seen.add(mod.id)
        allModules.push(mod)
      }
    }
  }

  const completedCount = allModules.filter(m => completedModules.includes(m.id)).length
  const inProgressCount = allModules.length - completedCount

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3f0' }}>
        <p style={{ color: '#71717a', fontFamily: 'Barlow, sans-serif' }}>Loading...</p>
      </main>
    )
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div style={{ background: '#f4f3f0', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
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
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
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
          <div style={{ fontSize: '14px', color: '#71717a', marginTop: '3px' }}>{email}</div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Modules Completed', value: String(completedCount), color: '#16a34a' },
            { label: 'In Progress', value: String(inProgressCount), color: '#f97316' },
            { label: 'Waivers Issued', value: String(completedCount), color: '#2563eb' },
            { label: 'Classes Enrolled', value: String(enrolledClasses.length), color: '#1a1a1c' },
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
              onKeyDown={(e) => e.key === 'Enter' && handleEnrol()}
              placeholder="Class code e.g. TEST01"
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '11px 14px', color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', outline: 'none' }}
            />
            <button
              onClick={handleEnrol}
              disabled={enrolling}
              style={{ padding: '11px 22px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#000', fontSize: '14px', fontWeight: 700, cursor: enrolling ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: enrolling ? 0.7 : 1 }}
            >
              {enrolling ? 'Checking...' : 'Join Class →'}
            </button>
          </div>
          {enrollMessage && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: enrollMessage.includes('Invalid') || enrollMessage.includes('wrong') ? '#f87171' : '#86efac' }}>
              {enrollMessage}
            </div>
          )}
        </div>

        {/* Modules Section */}
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a', marginBottom: '12px' }}>
          My Modules
        </div>

        {allModules.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px dashed #d0cfcb', borderRadius: '12px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#71717a', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 300 }}>+</div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>No modules yet</div>
            <div style={{ fontSize: '12px' }}>Join a class above to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {allModules.map((mod) => {
              const isComplete = completedModules.includes(mod.id)
              const url = getModuleUrl(mod.machine_key)
              return (
                <div
                  key={mod.id}
                  style={{ background: '#fff', border: `1.5px solid ${isComplete ? 'rgba(22,163,74,0.3)' : '#e4e4e0'}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  {/* Module Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: isComplete ? 'rgba(22,163,74,0.1)' : 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                      {getModuleIcon(mod.subject)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: 700, lineHeight: 1.2 }}>{mod.name}</div>
                      <div style={{ fontSize: '12px', color: '#71717a', marginTop: '3px' }}>{mod.subject}</div>
                    </div>
                    {isComplete && (
                      <div style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✓ Complete
                      </div>
                    )}
                  </div>

                  {/* Module Meta */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#71717a' }}>
                      <span style={{ fontWeight: 600, color: '#1a1a1c' }}>{mod.section_count}</span> sections
                    </div>
                    <div style={{ fontSize: '12px', color: '#71717a' }}>
                      <span style={{ fontWeight: 600, color: '#1a1a1c' }}>{mod.estimated_minutes}</span> min
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div style={{ height: '4px', background: '#f4f3f0', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: isComplete ? '100%' : '0%', background: isComplete ? '#16a34a' : '#f97316', borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>

                  {/* Action Button */}
                  <a
                    href={url}
                    style={{ display: 'block', textAlign: 'center', padding: '10px', background: isComplete ? 'rgba(22,163,74,0.1)' : '#f97316', color: isComplete ? '#16a34a' : '#000', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.04em' }}
                  >
                    {isComplete ? 'Review Module' : 'Start Module →'}
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

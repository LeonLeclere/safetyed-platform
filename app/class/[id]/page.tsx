'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Module = {
  id: string
  name: string
  machine_key: string
  subject: string
  estimated_minutes: number
  section_count: number
}

type ClassInfo = {
  id: string
  name: string
  subject: string
}

export default function ClassPage() {
  const [loading, setLoading] = useState(true)
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [completedModules, setCompletedModules] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const router = useRouter()
  const params = useParams()
  const classId = params.id as string

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? '')

      // Verify student is enrolled in this class
      const { data: enrolment } = await supabase
        .from('enrolments')
        .select('id')
        .eq('student_id', user.id)
        .eq('class_id', classId)
        .single()

      if (!enrolment) {
        router.push('/dashboard')
        return
      }

      // Load class info
      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, subject')
        .eq('id', classId)
        .single()

      if (cls) setClassInfo(cls)

      // Load modules for this class
      const { data: classModules } = await supabase
        .from('class_modules')
        .select('sort_order, module:modules(id, name, machine_key, subject, estimated_minutes, section_count)')
        .eq('class_id', classId)
        .order('sort_order')

      const mods: Module[] = (classModules ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((cm: any) => cm.module as Module)
        .filter(Boolean)

      setModules(mods)

      // Load completions
      const { data: attempts } = await supabase
        .from('attempts')
        .select('module_id')
        .eq('student_id', user.id)
        .eq('passed', true)

      if (attempts) {
        setCompletedModules(attempts.map(a => a.module_id))
      }

      setLoading(false)
    }
    init()
  }, [classId, router])

  function getModuleUrl(machineKey: string): string {
    const map: Record<string, string> = {
      'knife': '/modules/kitchen-knives.html',
      'bandsaw': '/modules/bandsaw.html',
    }
    return map[machineKey] ?? '#'
  }

  function getSubjectIcon(subject: string): string {
    if (subject.toLowerCase().includes('food')) return '🍽️'
    if (subject.toLowerCase().includes('wood')) return '🪚'
    if (subject.toLowerCase().includes('metal')) return '⚙️'
    return '📋'
  }

  const initials = email.slice(0, 2).toUpperCase()

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3f0' }}>
        <p style={{ color: '#71717a', fontFamily: 'Barlow, sans-serif' }}>Loading...</p>
      </main>
    )
  }

  return (
    <div style={{ background: '#f4f3f0', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');`}</style>

      <nav style={{ background: '#1a1a1c', height: '56px', display: 'flex', alignItems: 'center', padding: '0 28px', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          Safety<span style={{ color: '#f97316' }}>Ed</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
        >
          ← My Training
        </button>
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

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Class Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '13px', color: '#71717a', marginBottom: '6px' }}>
            {classInfo?.subject}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700 }}>
            {classInfo?.name}
          </div>
          <div style={{ fontSize: '14px', color: '#71717a', marginTop: '4px' }}>
            {modules.length} {modules.length === 1 ? 'module' : 'modules'} assigned
          </div>
        </div>

        {/* Modules */}
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a', marginBottom: '12px' }}>
          Modules
        </div>

        {modules.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px dashed #d0cfcb', borderRadius: '12px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#71717a', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>No modules assigned yet</div>
            <div style={{ fontSize: '12px' }}>Your teacher has not added any modules to this class</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modules.map((mod, index) => {
              const isComplete = completedModules.includes(mod.id)
              const url = getModuleUrl(mod.machine_key)
              return (
                <div
                  key={mod.id}
                  style={{ background: '#fff', border: `1.5px solid ${isComplete ? 'rgba(22,163,74,0.3)' : '#e4e4e0'}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}
                >
                  {/* Number */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isComplete ? 'rgba(22,163,74,0.1)' : '#f4f3f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, color: isComplete ? '#16a34a' : '#71717a', flexShrink: 0 }}>
                    {isComplete ? '✓' : index + 1}
                  </div>

                  {/* Icon */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: isComplete ? 'rgba(22,163,74,0.1)' : 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {getSubjectIcon(mod.subject)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700 }}>{mod.name}</div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                      {mod.section_count} sections · {mod.estimated_minutes} min
                    </div>
                  </div>

                  {/* Status badge */}
                  {isComplete && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ✓ Complete
                    </div>
                  )}

                  {/* Button */}
                  <a
                    href={url}
                    style={{ padding: '10px 20px', background: isComplete ? 'rgba(22,163,74,0.1)' : '#f97316', color: isComplete ? '#16a34a' : '#000', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {isComplete ? 'Review' : 'Start →'}
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

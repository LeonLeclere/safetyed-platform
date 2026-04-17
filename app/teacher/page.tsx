'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type Class = {
  id: string
  name: string
  subject: string
  year_level: number
  join_code: string
  created_at: string
}

type Module = {
  id: string
  name: string
  machine_key: string
  subject: string
  estimated_minutes: number
}

export default function TeacherPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState('')

  // New class form
  const [className, setClassName] = useState('')
  const [subject, setSubject] = useState('Food Technology')
  const [yearLevel, setYearLevel] = useState('10')
  const [selectedModules, setSelectedModules] = useState<string[]>([])

  const router = useRouter()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Verify teacher role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'teacher') {
        router.push('/dashboard')
        return
      }

      setEmail(user.email ?? '')
      await loadClasses(user.id)
      await loadModules()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadClasses(uid: string) {
    const { data } = await supabase
      .from('classes')
      .select('id, name, subject, year_level, join_code, created_at')
      .eq('teacher_id', uid)
      .order('created_at', { ascending: false })

    if (data) setClasses(data)
  }

  async function loadModules() {
    const { data } = await supabase
      .from('modules')
      .select('id, name, machine_key, subject, estimated_minutes')
      .eq('is_active', true)

    if (data) setModules(data)
  }

  async function handleCreateClass() {
    if (!className.trim()) {
      setCreateMessage('Class name is required.')
      return
    }
    if (selectedModules.length === 0) {
      setCreateMessage('Select at least one module.')
      return
    }

    setCreating(true)
    setCreateMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get teacher school_id from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    if (!profile?.school_id) {
      setCreateMessage('No school linked to your account. Contact admin.')
      setCreating(false)
      return
    }

    // Create the class
    const { data: newClass, error: classError } = await supabase
      .from('classes')
      .insert({
        teacher_id: user.id,
        school_id: profile.school_id,
        name: className.trim(),
        subject,
        year_level: parseInt(yearLevel),
      })
      .select()
      .single()

    if (classError || !newClass) {
      setCreateMessage('Failed to create class. Try again.')
      setCreating(false)
      return
    }

    // Assign selected modules
    const moduleInserts = selectedModules.map((moduleId, index) => ({
      class_id: newClass.id,
      module_id: moduleId,
      sort_order: index + 1,
    }))

    await supabase.from('class_modules').insert(moduleInserts)

    // Reset form
    setClassName('')
    setSubject('Food Technology')
    setYearLevel('10')
    setSelectedModules([])
    setShowCreateClass(false)
    setCreateMessage('')
    setCreating(false)

    await loadClasses(user.id)
  }

  function toggleModule(id: string) {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
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

      {/* Nav */}
      <nav style={{ background: '#1a1a1c', height: '56px', display: 'flex', alignItems: 'center', padding: '0 28px', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          Safety<span style={{ color: '#f97316' }}>Ed</span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          Teacher Portal
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

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '30px', fontWeight: 700 }}>My Classes</div>
            <div style={{ fontSize: '14px', color: '#71717a', marginTop: '3px' }}>{email}</div>
          </div>
          <button
            onClick={() => { setShowCreateClass(true); setCreateMessage('') }}
            style={{ padding: '11px 22px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#000', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            + New Class
          </button>
        </div>

        {/* Create Class Form */}
        {showCreateClass && (
          <div style={{ background: '#1a1a1c', borderRadius: '12px', padding: '24px', marginBottom: '24px', color: '#fff' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Create New Class</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Class Name</label>
                <input
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  placeholder="e.g. Year 10 Food Tech A"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Subject</label>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                >
<option value="Food Technology">Food Technology</option>
<option value="Hospitality Practices">Hospitality Practices</option>
<option value="Industrial Technology and Design">Industrial Technology and Design</option>
<option value="Furnishing Skills">Furnishing Skills</option>
<option value="Engineering Skills">Engineering Skills</option>
<option value="Agriculture">Agriculture</option>
<option value="Science">Science</option>
<option value="HPE">HPE</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Year</label>
                <select
                  value={yearLevel}
                  onChange={e => setYearLevel(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                >
                  {[7,8,9,10,11,12].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Module Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Assign Modules</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {modules.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: selectedModules.includes(mod.id) ? '1.5px solid #f97316' : '1.5px solid rgba(255,255,255,0.15)',
                      background: selectedModules.includes(mod.id) ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                      color: selectedModules.includes(mod.id) ? '#f97316' : 'rgba(255,255,255,0.7)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedModules.includes(mod.id) ? '✓ ' : ''}{mod.name}
                  </button>
                ))}
              </div>
            </div>

            {createMessage && (
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#f87171' }}>{createMessage}</div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCreateClass}
                disabled={creating}
                style={{ padding: '11px 24px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#000', fontSize: '14px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? 'Creating...' : 'Create Class →'}
              </button>
              <button
                onClick={() => setShowCreateClass(false)}
                style={{ padding: '11px 24px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Classes List */}
        {classes.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px dashed #d0cfcb', borderRadius: '12px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#71717a', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 300 }}>+</div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>No classes yet</div>
            <div style={{ fontSize: '12px' }}>Click New Class to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {classes.map(cls => (
              <div key={cls.id} style={{ background: '#fff', border: '1.5px solid #e4e4e0', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700 }}>{cls.name}</div>
                  <div style={{ fontSize: '13px', color: '#71717a', marginTop: '2px' }}>{cls.subject} · Year {cls.year_level}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Join Code</div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '24px', fontWeight: 800, color: '#f97316', letterSpacing: '0.15em' }}>{cls.join_code}</div>
                </div>
                <button
                  onClick={() => copyCode(cls.join_code)}
                  style={{ padding: '10px 18px', background: '#f4f3f0', border: '1.5px solid #e4e4e0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#1a1a1c' }}
                >
                  Copy Code
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

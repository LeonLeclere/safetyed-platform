'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Student = {
  id: string
  first_name: string
  last_initial: string
  year_level: number | null
}

type Module = {
  id: string
  name: string
  machine_key: string
  estimated_minutes: number
  sort_order: number
}

type Attempt = {
  id: string
  student_id: string
  module_id: string
  passed: boolean
  completed_at: string | null
  score: number | null
}

type Progress = {
  attempt_id: string
  section_number: number
  completed: boolean
  updated_at: string
}

type ClassInfo = {
  id: string
  name: string
  subject: string
  year_level: number
  join_code: string
}

// Student is "live" if they have progress updated in the last 3 minutes
const LIVE_THRESHOLD_MS = 3 * 60 * 1000

export default function ClassRosterPage() {
  const params = useParams()
  const classId = params.classId as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  // Keep attempts in a ref so Realtime callbacks can access current value
  const attemptsRef = useRef<Attempt[]>([])
  attemptsRef.current = attempts

  // Tick every 30s to keep "X min ago" fresh and re-evaluate live status
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const loadProgress = useCallback(async (attemptIds: string[]) => {
    if (attemptIds.length === 0) return
    const { data } = await supabase
      .from('progress')
      .select('attempt_id, section_number, completed, updated_at')
      .in('attempt_id', attemptIds)
    if (data) setProgress(data)
  }, [])

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Verify teacher owns this class
      const { data: cls, error: clsError } = await supabase
        .from('classes')
        .select('id, name, subject, year_level, join_code')
        .eq('id', classId)
        .eq('teacher_id', user.id)
        .single()

      if (clsError || !cls) {
        setError('Class not found or access denied.')
        setLoading(false)
        return
      }
      setClassInfo(cls)

      // Load assigned modules
      const { data: classModules } = await supabase
        .from('class_modules')
        .select('module_id, sort_order, modules(id, name, machine_key, estimated_minutes)')
        .eq('class_id', classId)
        .order('sort_order', { ascending: true })

      if (classModules) {
        const mods: Module[] = classModules
          .filter((cm: any) => cm.modules)
          .map((cm: any) => ({
            id: cm.modules.id,
            name: cm.modules.name,
            machine_key: cm.modules.machine_key,
            estimated_minutes: cm.modules.estimated_minutes,
            sort_order: cm.sort_order,
          }))
        setModules(mods)
      }

      // Load enrolled students
      const { data: enrolments } = await supabase
        .from('enrolments')
        .select('student_id, profiles:student_id(id, first_name, last_initial, year_level)')
        .eq('class_id', classId)

      // Note: if roster shows 0 students when students have joined,
      // swap 'profiles:student_id' to 'users:student_id' — depends which table name your codebase uses
      let studs: Student[] = []
      if (enrolments) {
        studs = enrolments
          .filter((e: any) => e.profiles)
          .map((e: any) => ({
            id: e.profiles.id,
            first_name: e.profiles.first_name,
            last_initial: e.profiles.last_initial,
            year_level: e.profiles.year_level,
          }))
        studs.sort((a, b) => a.first_name.localeCompare(b.first_name))
        setStudents(studs)
      }

      // Load attempts
      let attemptList: Attempt[] = []
      if (studs.length > 0) {
        const studentIds = studs.map(s => s.id)
        const { data: attemptData } = await supabase
          .from('attempts')
          .select('id, student_id, module_id, passed, completed_at, score')
          .in('student_id', studentIds)
          .eq('class_id', classId)

        if (attemptData) {
          attemptList = attemptData
          setAttempts(attemptData)
          await loadProgress(attemptData.map((a: Attempt) => a.id))
        }
      }

      setLoading(false)

      // --- Supabase Realtime ---
      // Subscribes to ALL progress changes then filters client-side
      // (Realtime filter on foreign key chains is not supported)
      realtimeChannel = supabase
        .channel(`class-${classId}-progress`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'progress',
          },
          async (payload) => {
            const row = payload.new as Progress

            // Only process if this attempt belongs to one of our class's students
            const matchingAttempt = attemptsRef.current.find(a => a.id === row.attempt_id)
            if (!matchingAttempt) {
              // Could be a new attempt — reload attempts then progress
              if (studs.length === 0) return
              const studentIds = studs.map(s => s.id)
              const { data: fresh } = await supabase
                .from('attempts')
                .select('id, student_id, module_id, passed, completed_at, score')
                .in('student_id', studentIds)
                .eq('class_id', classId)
              if (fresh) {
                attemptsRef.current = fresh
                setAttempts(fresh)
                await loadProgress(fresh.map((a: Attempt) => a.id))
              }
              return
            }

            // Update this progress row in state
            setProgress(prev => {
              const existing = prev.findIndex(
                p => p.attempt_id === row.attempt_id && p.section_number === row.section_number
              )
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = row
                return updated
              }
              return [...prev, row]
            })

            // If section completed, refresh attempt in case it's now passed
            if (row.completed) {
              const { data: fresh } = await supabase
                .from('attempts')
                .select('id, student_id, module_id, passed, completed_at, score')
                .eq('id', matchingAttempt.id)
                .single()
              if (fresh) {
                setAttempts(prev => prev.map(a => a.id === fresh.id ? fresh : a))
              }
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    }
  }, [classId, router, loadProgress])

  // --- Helpers ---

  function getAttempt(studentId: string, moduleId: string): Attempt | undefined {
    return attempts.find(a => a.student_id === studentId && a.module_id === moduleId)
  }

  function getProgressForAttempt(attemptId: string): Progress[] {
    return progress.filter(p => p.attempt_id === attemptId)
  }

  function getLatestSection(attemptId: string): { section: number; updatedAt: string } | null {
    const rows = getProgressForAttempt(attemptId)
    if (rows.length === 0) return null
    const latest = rows.reduce((a, b) =>
      new Date(a.updated_at) > new Date(b.updated_at) ? a : b
    )
    return { section: latest.section_number, updatedAt: latest.updated_at }
  }

  function isLive(attemptId: string): boolean {
    const latest = getLatestSection(attemptId)
    if (!latest) return false
    return now - new Date(latest.updatedAt).getTime() < LIVE_THRESHOLD_MS
  }

  function timeAgo(isoString: string): string {
    const ms = now - new Date(isoString).getTime()
    const mins = Math.floor(ms / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(isoString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  function getCompletionCount(): number {
    return attempts.filter(a => a.passed).length
  }

  function getLiveCount(): number {
    return attempts.filter(a => isLive(a.id)).length
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3f0' }}>
        <p style={{ color: '#71717a', fontFamily: 'Barlow, sans-serif' }}>Loading class...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3f0' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Barlow, sans-serif' }}>
          <div style={{ color: '#ef4444', marginBottom: '12px' }}>{error}</div>
          <button
            onClick={() => router.push('/teacher')}
            style={{ padding: '10px 20px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 700, cursor: 'pointer' }}
          >
            Back to My Classes
          </button>
        </div>
      </main>
    )
  }

  return (
    <div style={{ background: '#f4f3f0', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-dot { animation: pulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Nav */}
      <nav style={{ background: '#1a1a1c', height: '56px', display: 'flex', alignItems: 'center', padding: '0 28px', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          Safety<span style={{ color: '#f97316' }}>Ed</span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          Teacher Portal
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push('/teacher')}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}
          >
            ← My Classes
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Class Header */}
        <div style={{ background: '#1a1a1c', borderRadius: '12px', padding: '24px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, color: '#fff' }}>
              {classInfo?.name}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              {classInfo?.subject} · Year {classInfo?.year_level} · {students.length} student{students.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Join Code</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 800, color: '#f97316', letterSpacing: '0.15em' }}>
                {classInfo?.join_code}
              </div>
            </div>
            <button
              onClick={() => classInfo && copyCode(classInfo.join_code)}
              style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Students Enrolled', value: students.length, highlight: false },
            { label: 'Modules Assigned', value: modules.length, highlight: false },
            { label: 'Completions', value: getCompletionCount(), highlight: false },
            { label: 'Active Now', value: getLiveCount(), highlight: getLiveCount() > 0 },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: `1.5px solid ${stat.highlight ? '#f97316' : '#e4e4e0'}`, borderRadius: '12px', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, color: stat.highlight ? '#f97316' : '#1a1a1c' }}>
                  {stat.value}
                </span>
                {stat.highlight && (
                  <span className="live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Roster Table */}
        {students.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px dashed #d0cfcb', borderRadius: '12px', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#71717a', textAlign: 'center' }}>
            <div style={{ fontSize: '28px' }}>👥</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>No students enrolled yet</div>
            <div style={{ fontSize: '13px' }}>Share the join code <strong style={{ color: '#f97316' }}>{classInfo?.join_code}</strong> with your class</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1.5px solid #e4e4e0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${260 + modules.length * 160}px` }}>
                <thead>
                  <tr style={{ background: '#f4f3f0', borderBottom: '1.5px solid #e4e4e0' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, color: '#71717a', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '220px' }}>
                      Student
                    </th>
                    {modules.map(mod => (
                      <th key={mod.id} style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: 700, color: '#71717a', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '150px' }}>
                        <div>{mod.name}</div>
                        <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 400, marginTop: '2px', textTransform: 'none', letterSpacing: 0 }}>{mod.estimated_minutes} min</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, i) => {
                    const studentAttempts = attempts.filter(a => a.student_id === student.id)
                    const liveAttempt = studentAttempts.find(a => isLive(a.id))
                    const completedCount = studentAttempts.filter(a => a.passed).length
                    const allDone = completedCount === modules.length && modules.length > 0

                    return (
                      <tr
                        key={student.id}
                        style={{
                          background: liveAttempt ? 'rgba(34,197,94,0.04)' : i % 2 === 0 ? '#fff' : '#fafaf9',
                          borderBottom: '1px solid #e4e4e0',
                          transition: 'background 0.3s',
                        }}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: allDone ? '#f97316' : liveAttempt ? '#22c55e' : '#e4e4e0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: 700,
                                color: allDone || liveAttempt ? '#fff' : '#71717a',
                              }}>
                                {student.first_name[0]}{student.last_initial}
                              </div>
                              {liveAttempt && (
                                <span className="live-dot" style={{
                                  position: 'absolute', top: '-2px', right: '-2px',
                                  width: '10px', height: '10px', borderRadius: '50%',
                                  background: '#22c55e', border: '2px solid #fff',
                                  display: 'block',
                                }} />
                              )}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                                  {student.first_name} {student.last_initial}.
                                </span>
                                {liveAttempt && (
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: '99px' }}>
                                    LIVE
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '1px' }}>
                                {completedCount}/{modules.length} complete
                                {student.year_level ? ` · Yr ${student.year_level}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {modules.map(mod => {
                          const attempt = getAttempt(student.id, mod.id)
                          const passed = attempt?.passed
                          const live = attempt ? isLive(attempt.id) : false
                          const latestSection = attempt ? getLatestSection(attempt.id) : null
                          const progressRows = attempt ? getProgressForAttempt(attempt.id) : []
                          const sectionsCompleted = progressRows.filter(p => p.completed).length

                          const date = attempt?.completed_at
                            ? new Date(attempt.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                            : null

                          if (passed) {
                            return (
                              <td key={mod.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', fontSize: '14px', fontWeight: 700 }}>✓</div>
                                {date && <div style={{ fontSize: '11px', color: '#71717a', marginTop: '3px' }}>{date}</div>}
                              </td>
                            )
                          }

                          if (live && latestSection) {
                            return (
                              <td key={mod.id} style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', marginBottom: '5px' }}>
                                  Section {latestSection.section} of 5
                                </div>
                                <div style={{ background: '#e4e4e0', borderRadius: '99px', height: '6px', width: '100%', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${(sectionsCompleted / 5) * 100}%`,
                                    background: '#22c55e',
                                    borderRadius: '99px',
                                    transition: 'width 0.4s ease',
                                    minWidth: sectionsCompleted > 0 ? '6px' : '0',
                                  }} />
                                </div>
                                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                                  {timeAgo(latestSection.updatedAt)}
                                </div>
                              </td>
                            )
                          }

                          if (attempt && !passed) {
                            return (
                              <td key={mod.id} style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', fontSize: '12px', fontWeight: 700 }}>…</div>
                                {latestSection && (
                                  <div style={{ fontSize: '11px', color: '#71717a', marginTop: '3px' }}>
                                    Sec {latestSection.section} · {timeAgo(latestSection.updatedAt)}
                                  </div>
                                )}
                              </td>
                            )
                          }

                          return (
                            <td key={mod.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#f4f3f0', color: '#d0cfcb', fontSize: '14px' }}>—</div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e4e4e0', display: 'flex', gap: '20px', flexWrap: 'wrap', background: '#fafaf9', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend:</div>
              {[
                { bg: '#dcfce7', color: '#16a34a', symbol: '✓', label: 'Passed', pulse: false },
                { bg: '#22c55e', color: '#fff', symbol: '●', label: 'Live now', pulse: true },
                { bg: '#fef3c7', color: '#d97706', symbol: '…', label: 'In progress', pulse: false },
                { bg: '#f4f3f0', color: '#d0cfcb', symbol: '—', label: 'Not started', pulse: false },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#71717a' }}>
                  <div
                    className={item.pulse ? 'live-dot' : ''}
                    style={{ width: '20px', height: '20px', borderRadius: '50%', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}
                  >
                    {item.symbol}
                  </div>
                  {item.label}
                </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#a1a1aa' }}>
                Live = active in last 3 min · updates automatically
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type School = {
  id: string
  name: string
  region: string
}

export default function SignupPage() {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [schoolQuery, setSchoolQuery] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastInitial, setLastInitial] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (schoolQuery.length < 2) {
      setSchools([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, region')
        .ilike('name', `%${schoolQuery}%`)
        .order('name')
        .limit(10)

      if (!error && data) {
        setSchools(data)
        setShowDropdown(true)
      }
      setSearchLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [schoolQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectSchool(school: School) {
    setSelectedSchool(school)
    setSchoolQuery(school.name)
    setShowDropdown(false)
  }

  function clearSchool() {
    setSelectedSchool(null)
    setSchoolQuery('')
    setSchools([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedSchool) { setError('Please select your school from the list.'); return }
    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastInitial.trim() || lastInitial.length > 1) { setError('Last initial must be a single letter.'); return }
    if (!yearLevel) { setError('Please select your year level.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authError) { setError(authError.message); setLoading(false); return }
      if (!authData.user) { setError('Account creation failed. Please try again.'); setLoading(false); return }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: firstName.trim(),
          last_initial: lastInitial.trim().toUpperCase(),
          role: 'student',
          school_id: selectedSchool.id,
          year_level: parseInt(yearLevel),
        })

      if (profileError) { setError('Account created but profile setup failed. Contact support.'); setLoading(false); return }

      router.push('/dashboard')

    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Barlow', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ width: '100%', maxWidth: '480px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '28px',
            fontWeight: 700,
            color: '#f97316',
            letterSpacing: '0.5px',
            marginBottom: '6px',
          }}>
            SafetyEd QLD
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Create your student account</div>
        </div>

        <div style={{
          background: '#1a1d27',
          borderRadius: '16px',
          border: '1px solid #2a2d3a',
          padding: '32px',
        }}>
          <form onSubmit={handleSubmit}>

            {/* SCHOOL SEARCH */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Your School</label>
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <input
                  type="text"
                  value={schoolQuery}
                  onChange={e => { setSchoolQuery(e.target.value); if (selectedSchool) setSelectedSchool(null) }}
                  placeholder="Start typing your school name..."
                  style={{ ...inputStyle, paddingRight: selectedSchool ? '40px' : '14px', borderColor: selectedSchool ? '#22c55e' : '#2a2d3a' }}
                  autoComplete="off"
                />

                {selectedSchool && (
                  <button type="button" onClick={clearSchool} style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                  }}>✕</button>
                )}

                {selectedSchool && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#22c55e' }}>
                    ✓ {selectedSchool.name}{selectedSchool.region ? ` · ${selectedSchool.region}` : ''}
                  </div>
                )}

                {showDropdown && schools.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#1e2130', border: '1px solid #2a2d3a', borderRadius: '10px',
                    marginTop: '4px', zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {schools.map(school => (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => selectSchool(school)}
                        style={{
                          width: '100%', textAlign: 'left', background: 'none',
                          border: 'none', borderBottom: '1px solid #2a2d3a',
                          padding: '12px 14px', cursor: 'pointer', color: '#e5e7eb',
                          fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '2px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#252838')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontWeight: 600 }}>{school.name}</span>
                        {school.region && <span style={{ fontSize: '12px', color: '#6b7280' }}>{school.region}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && schools.length === 0 && !searchLoading && schoolQuery.length >= 2 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#1e2130', border: '1px solid #2a2d3a', borderRadius: '10px',
                    marginTop: '4px', padding: '14px', color: '#6b7280', fontSize: '13px', zIndex: 50,
                  }}>
                    No schools found. Contact your teacher if your school isn't listed.
                  </div>
                )}
              </div>
            </div>

            {/* NAME ROW */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Jordan" style={inputStyle} autoComplete="given-name" />
              </div>
              <div style={{ width: '90px' }}>
                <label style={labelStyle}>Last Initial</label>
                <input type="text" value={lastInitial} onChange={e => setLastInitial(e.target.value.slice(0, 1))}
                  placeholder="M" maxLength={1}
                  style={{ ...inputStyle, textAlign: 'center', textTransform: 'uppercase' }} autoComplete="off" />
              </div>
            </div>

            {/* YEAR LEVEL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Year Level</label>
              <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Select year level...</option>
                {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            {/* EMAIL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>School Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jordan.m@eq.edu.au" style={inputStyle} autoComplete="email" />
            </div>

            {/* PASSWORD ROW */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters" style={inputStyle} autoComplete="new-password" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete="new-password" />
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 14px', color: '#f87171',
                fontSize: '13px', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#6b2d0a' : '#f97316',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Barlow', sans-serif", transition: 'background 0.2s',
            }}>
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>

          </form>

          <div style={{
            marginTop: '20px', padding: '10px 14px',
            background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)',
            borderRadius: '8px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.6,
          }}>
            🔒 QLD Privacy Compliant — We store: first name, last initial, year level, and school email only.
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>Log in</a>
          </div>

        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#0f1117',
  border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e5e7eb',
  fontSize: '14px', fontFamily: "'Barlow', sans-serif", outline: 'none', boxSizing: 'border-box',
}

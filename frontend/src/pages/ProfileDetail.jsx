import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { BACKEND_ADDRESS } from '../config'

const ProfileDetail = () => {
  const { user, getToken, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formBio, setFormBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword1, setNewPassword1] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [editingBio, setEditingBio] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) return
      setLoading(true)
      setError('')
      try {
        const token = getToken()
        const res = await fetch(`${BACKEND_ADDRESS}auth/profile/`, { headers: { 'Authorization': `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed to fetch profile')
        const data = await res.json()
        setProfile(data)
        setFormEmail(data.email || '')
        setFormPhone(data.profile?.phone_number || '')
        setFormBio(data.profile?.bio || '')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [isAuthenticated])

  const updateContact = async () => {
    setStatusMsg('')
    setSaving(true)
    try {
      const token = getToken()
      const payload = { email: formEmail, profile: { phone_number: formPhone, bio: formBio } }
      const res = await fetch(`${BACKEND_ADDRESS}auth/profile/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j.detail || 'Failed updating profile')
      }
      const updated = await res.json().catch(()=>null)
      setProfile(prev => ({
        ...(prev || {}),
        email: updated?.email ?? formEmail,
        profile: {
          ...(prev?.profile || {}),
          phone_number: updated?.profile?.phone_number ?? formPhone,
          bio: updated?.profile?.bio ?? formBio
        }
      }))
      setStatusMsg('Profile updated')
      return true
    } catch (e) {
      setStatusMsg(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setStatusMsg('')
    if (!currentPassword || !newPassword1 || !newPassword2) {
      setStatusMsg('Fill all password fields')
      return
    }
    if (newPassword1 !== newPassword2) {
      setStatusMsg('New passwords do not match')
      return
    }
    if (newPassword1.length < 8) {
      setStatusMsg('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND_ADDRESS}auth/profile/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword1, current_password: currentPassword })
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j.detail || 'Password change failed (backend may need endpoint)')
      }
      setStatusMsg('Password changed')
      setCurrentPassword('')
      setNewPassword1('')
      setNewPassword2('')
      setShowPasswordForm(false)
    } catch (e) {
      setStatusMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading profile...</div>
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>{error}</div>
  if (!profile) return null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0 }}>My Profile</h1>
      <section style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Account</h3>
            <p><strong>Username:</strong> {profile.username}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>Email:</strong>{' '}
              {editingEmail ? (
                <>
                  <input value={formEmail} onChange={e=>setFormEmail(e.target.value)} style={{ flex: 1 }} />
                  <button onClick={async () => { const ok = await updateContact(); if(ok) setEditingEmail(false) }} title="Save email" style={iconBtnStyle}>💾</button>
                  <button onClick={() => { setEditingEmail(false); setFormEmail(profile.email || '') }} title="Cancel" style={iconBtnStyle}>✖</button>
                </>
              ) : (
                <>
                  <span>{profile.email}</span>
                  <button onClick={() => setEditingEmail(true)} title="Edit email" style={iconBtnStyle}>✏️</button>
                </>
              )}
            </p>
            <p><strong>First name:</strong> {profile.first_name || '—'}</p>
            <p><strong>Last name:</strong> {profile.last_name || '—'}</p>
            <p><strong>Joined:</strong> {new Date(profile.date_joined).toLocaleString()}</p>
            <p><strong>Status:</strong> {profile.is_active ? 'Active' : 'Inactive (awaiting approval)'}</p>
            <p><strong>Role:</strong> {profile.is_staff ? 'Admin' : 'User'}</p>
          </div>
        </div>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Profile</h3>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>Phone:</strong>{' '}
              {editingPhone ? (
                <>
                  <input value={formPhone} onChange={e=>setFormPhone(e.target.value)} style={{ flex: 1 }} />
                  <button onClick={async () => { const ok = await updateContact(); if(ok) setEditingPhone(false) }} title="Save phone" style={iconBtnStyle}>💾</button>
                  <button onClick={() => { setEditingPhone(false); setFormPhone(profile.profile?.phone_number || '') }} title="Cancel" style={iconBtnStyle}>✖</button>
                </>
              ) : (
                <>
                  <span>{profile.profile?.phone_number || '—'}</span>
                  <button onClick={() => setEditingPhone(true)} title="Edit phone" style={iconBtnStyle}>✏️</button>
                </>
              )}
            </p>
            <p><strong>AFM:</strong> {profile.profile?.afm || '—'}</p>
            <div style={{ marginTop: 12 }}>
              <strong>Bio:</strong>
              {editingBio ? (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={formBio}
                    onChange={e => setFormBio(e.target.value.slice(0,500))}
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, padding: 8 }}
                    placeholder="Tell us about yourself (max 500 chars)"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formBio.length}/500</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={async () => { const ok = await updateContact(); if (ok) setEditingBio(false) }} title="Save bio" style={iconBtnStyle}>💾</button>
                      <button onClick={() => { setEditingBio(false); setFormBio(profile.profile?.bio || '') }} title="Cancel" style={iconBtnStyle}>✖</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{profile.profile?.bio || '—'}</p>
                  <button onClick={() => { setEditingBio(true); setFormBio(profile.profile?.bio || '') }} title="Edit bio" style={iconBtnStyle}>✏️</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Security / Password Section */}
      <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Security</h3>
        {!showPasswordForm ? (
          <button onClick={() => setShowPasswordForm(true)} style={primaryBtnStyle}>Change Password</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Current password" />
            <input type="password" value={newPassword1} onChange={e=>setNewPassword1(e.target.value)} placeholder="New password" />
            <input type="password" value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} placeholder="Confirm new password" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={saving} onClick={changePassword} style={successBtnStyle}>Save Password</button>
              <button disabled={saving} onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword1(''); setNewPassword2('') }} style={secondaryBtnStyle}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      {statusMsg && <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 8 }}>{statusMsg}</div>}
    </div>
  )
}

const iconBtnStyle = { border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }
const primaryBtnStyle = { padding: '10px 18px', background: 'linear-gradient(90deg,#2563eb,#1d4ed8)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }
const successBtnStyle = { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }
const secondaryBtnStyle = { padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }

export default ProfileDetail
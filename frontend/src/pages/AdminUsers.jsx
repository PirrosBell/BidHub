import React, { useEffect, useMemo, useState } from 'react'
import useApi from '../utils/UseApi'
import { BACKEND_ADDRESS } from '../config'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Admin.css'

const Table = ({ children }) => (
  <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      {children}
    </table>
  </div>
)

const Th = ({ children }) => (
  <th style={{ textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontWeight: 600, fontSize: 13, color: '#374151' }}>{children}</th>
)

const Td = ({ children, nowrap, ...props }) => (
  <td {...props} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: nowrap ? 'nowrap' : 'normal', fontSize: 14 }}>{children}</td>
)

const Badge = ({ color = '#0366d6', bg = '#e6f0ff', children }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: bg }}>{children}</span>
)

const AdminUsers = () => {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [ordering, setOrdering] = useState('username')

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (ordering) params.set('ordering', ordering)
    if (status === 'active') params.set('is_active', 'true')
    if (status === 'pending') params.set('pending', 'true')
    const qs = params.toString()
    return `auth/admin/users/${qs ? `?${qs}` : ''}`
  }, [search, ordering, status])

  const { data: users, error, isLoading, refetch } = useApi(endpoint)

  const [editing, setEditing] = useState(null) 
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const onApprove = async (userId) => {
    await callAction(userId, 'approve')
  }
  const onDeny = async (userId) => {
    if (!confirm('Deny and delete this registration? This cannot be undone.')) return
    await callAction(userId, 'deny')
  }

  const callAction = async (userId, action) => {
    try {
      setActionMsg('')
      const ok = await authorizedFetch(`auth/admin/users/${userId}/${action}/`, 'POST')
      if (!ok) throw new Error('Action failed')
      setActionMsg(action === 'approve' ? 'User approved.' : 'User denied and removed.')
      await refetch()
    } catch (e) {
      setActionMsg(e.message || 'Action failed')
    }
  }

  const authorizedFetch = async (endpoint, method = 'GET', body = null) => {
    const buildConfig = (token) => {
      const cfg = { method, headers: { Accept: 'application/json' }, credentials: 'include' }
      if (body) {
        cfg.headers['Content-Type'] = 'application/json'
        cfg.body = JSON.stringify(body)
      }
      if (token) cfg.headers['Authorization'] = `Bearer ${token}`
      return cfg
    }
    const refreshAccessToken = async () => {
      const refresh = localStorage.getItem('refreshToken')
      if (!refresh) return null
      const r = await fetch(`${BACKEND_ADDRESS}token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', body: JSON.stringify({ refresh }) })
      if (!r.ok) return null
      const j = await r.json()
      if (j?.access) { localStorage.setItem('accessToken', j.access); return j.access }
      return null
    }
    let token = localStorage.getItem('accessToken')
    let resp = await fetch(`${BACKEND_ADDRESS}${endpoint}`, buildConfig(token))
    if (resp.status === 401) {
      const newAccess = await refreshAccessToken()
      if (newAccess) {
        token = newAccess
        resp = await fetch(`${BACKEND_ADDRESS}${endpoint}`, buildConfig(token))
      }
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || resp.statusText)
    }
    return true
  }

  const startEdit = (u) => {
    setEditing({
      id: u.id,
      username: u.username,
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      is_active: !!u.is_active,
      profile: {
        bio: u.profile?.bio || '',
        phone_number: u.profile?.phone_number || '',
        date_of_birth: u.profile?.date_of_birth || '',
      }
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const token = localStorage.getItem('accessToken')
      const resp = await fetch(`${BACKEND_ADDRESS}auth/admin/users/${editing.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        credentials: 'include',
        body: JSON.stringify({
          email: editing.email,
          first_name: editing.first_name,
          last_name: editing.last_name,
          is_active: editing.is_active,
          profile: {
            bio: editing.profile.bio,
            phone_number: editing.profile.phone_number,
            date_of_birth: editing.profile.date_of_birth || null,
          }
        })
      })
      if (resp.status === 401) {
        const refresh = localStorage.getItem('refreshToken')
        if (refresh) {
          const r = await fetch(`${BACKEND_ADDRESS}token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', body: JSON.stringify({ refresh }) })
          if (r.ok) {
            const j = await r.json()
            if (j?.access) {
              localStorage.setItem('accessToken', j.access)
              const resp2 = await fetch(`${BACKEND_ADDRESS}auth/admin/users/${editing.id}/`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${j.access}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                  email: editing.email,
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  is_active: editing.is_active,
                  profile: {
                    bio: editing.profile.bio,
                    phone_number: editing.profile.phone_number,
                    date_of_birth: editing.profile.date_of_birth || null,
                  }
                })
              })
              if (!resp2.ok) throw new Error('Save failed')
            }
          }
        }
      } else if (!resp.ok) {
        throw new Error('Save failed')
      }
      setEditing(null)
      await refetch()
    } catch (e) {
      alert(e.message || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  if (!user?.is_staff) {
    return (
      <div className="admin-page">
        <div className="admin-header" style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ marginRight: 'auto' }}>Users</h1>
          <Link to="/" style={{ color: '#0366d6', textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        </div>
        <div style={{ color: '#b91c1c' }}>Admins only.</div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header" style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ marginRight: 'auto' }}>Users</h1>
        <Link to="/admin" style={{ color: '#0366d6', textDecoration: 'none', fontWeight: 600 }}>← Back to Admin</Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, email, name"
          style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 260 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
        </select>
        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}>
          <option value="username">Username</option>
          <option value="-date_joined">Newest</option>
          <option value="date_joined">Oldest</option>
          <option value="email">Email</option>
        </select>
      </div>

      {actionMsg && <div style={{ margin: '8px 0 16px', color: '#065f46' }}>{actionMsg}</div>}
      {error && <div style={{ margin: '8px 0 16px', color: '#b91c1c' }}>{error}</div>}

      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><Td colSpan={6}>Loading...</Td></tr>
          )}
          {!isLoading && users && users.length === 0 && (
            <tr><Td colSpan={6}>No users</Td></tr>
          )}
          {!isLoading && users && users.map(u => (
            <tr key={u.id}>
              <Td nowrap>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{u.username}</strong>
                  {u.is_staff ? <Badge color="#7c3aed" bg="#f3e8ff">Staff</Badge> : null}
                </div>
              </Td>
              <Td>{u.email || '—'}</Td>
              <Td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</Td>
              <Td>{u.is_active ? <Badge color="#065f46" bg="#d1fae5">Active</Badge> : <Badge color="#92400e" bg="#fef3c7">Pending</Badge>}</Td>
              <Td>{new Date(u.date_joined).toLocaleString()}</Td>
              <Td nowrap>
                <button onClick={() => startEdit(u)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', marginRight: 8 }}>Edit</button>
                {!u.is_active && (
                  <>
                    <button onClick={() => onApprove(u.id)} style={{ padding: '6px 10px', border: '1px solid #059669', borderRadius: 8, background: '#10b981', color: '#fff', cursor: 'pointer', marginRight: 8 }}>Approve</button>
                    <button onClick={() => onDeny(u.id)} style={{ padding: '6px 10px', border: '1px solid #dc2626', borderRadius: 8, background: '#ef4444', color: '#fff', cursor: 'pointer' }}>Deny</button>
                  </>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(700px, 96vw)', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Edit User: {editing.username}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Email
                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Active
                <select value={editing.is_active ? '1' : '0'} onChange={e => setEditing({ ...editing, is_active: e.target.value === '1' })}>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>First name
                <input value={editing.first_name} onChange={e => setEditing({ ...editing, first_name: e.target.value })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Last name
                <input value={editing.last_name} onChange={e => setEditing({ ...editing, last_name: e.target.value })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>Bio
                <textarea rows={3} value={editing.profile.bio} onChange={e => setEditing({ ...editing, profile: { ...editing.profile, bio: e.target.value } })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Phone
                <input value={editing.profile.phone_number} onChange={e => setEditing({ ...editing, profile: { ...editing.profile, phone_number: e.target.value } })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>DOB (YYYY-MM-DD)
                <input value={editing.profile.date_of_birth || ''} onChange={e => setEditing({ ...editing, profile: { ...editing.profile, date_of_birth: e.target.value } })} placeholder="1990-01-31" />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button disabled={saving} onClick={() => setEditing(null)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8 }}>Cancel</button>
              <button disabled={saving} onClick={saveEdit} style={{ padding: '8px 12px', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: 8 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers

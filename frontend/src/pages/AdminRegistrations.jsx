import React, { useMemo, useState } from 'react'
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
const Td = ({ children, ...props }) => (
  <td {...props} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>{children}</td>
)
const Badge = ({ color = '#92400e', bg = '#fef3c7', children }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: bg }}>{children}</span>
)

const AdminRegistrations = () => {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [detailUser, setDetailUser] = useState(null)
  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('pending', 'true')
    params.set('ordering', '-date_joined')
    const qs = params.toString()
    return `auth/admin/users/${qs ? `?${qs}` : ''}`
  }, [search])

  const { data: users, error, isLoading, refetch } = useApi(endpoint)

  const authorizedPost = async (url, body = null) => {
    const buildConfig = (token) => {
      const cfg = { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'include' }
      if (body) { cfg.headers['Content-Type'] = 'application/json'; cfg.body = JSON.stringify(body) }
      if (token) cfg.headers['Authorization'] = `Bearer ${token}`
      return cfg
    }
    const refresh = async () => {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) return null
      const r = await fetch(`${BACKEND_ADDRESS}token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', body: JSON.stringify({ refresh: refreshToken }) })
      if (!r.ok) return null
      const j = await r.json()
      if (j?.access) { localStorage.setItem('accessToken', j.access); return j.access }
      return null
    }
    let token = localStorage.getItem('accessToken')
    let resp = await fetch(`${BACKEND_ADDRESS}${url}`, buildConfig(token))
    if (resp.status === 401) {
      const newAccess = await refresh()
      if (newAccess) resp = await fetch(`${BACKEND_ADDRESS}${url}`, buildConfig(newAccess))
    }
    if (!resp.ok) throw new Error('Request failed')
    return true
  }

  const approve = async (id) => { await authorizedPost(`auth/admin/users/${id}/approve/`); await refetch() }
  const deny = async (id) => { if (!confirm('Deny this registration?')) return; await authorizedPost(`auth/admin/users/${id}/deny/`); await refetch() }
  const requestChanges = async (id, message) => { await authorizedPost(`auth/admin/users/${id}/request_changes/`, { message }); await refetch() }

  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(null)

  if (!user?.is_staff) {
    return (
      <div className="admin-page">
        <div className="admin-header" style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ marginRight: 'auto' }}>Registrations</h1>
          <Link to="/" style={{ color: '#0366d6', textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        </div>
        <div style={{ color: '#b91c1c' }}>Admins only.</div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header" style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ marginRight: 'auto' }}>Registrations</h1>
        <Link to="/admin" style={{ color: '#0366d6', textDecoration: 'none', fontWeight: 600 }}>← Back to Admin</Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 260 }} />
      </div>

      {error && <div style={{ margin: '8px 0 16px', color: '#b91c1c' }}>{error}</div>}

      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Email</Th>
            <Th>Submitted</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><Td colSpan={4}>Loading...</Td></tr>
          )}
          {!isLoading && users && users.length === 0 && (
            <tr><Td colSpan={4}>No pending registrations</Td></tr>
          )}
          {!isLoading && users && users.map(u => (
            <tr key={u.id}>
              <Td>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong
                    onClick={() => setDetailUser(u)}
                    style={{ cursor: 'pointer', color: '#2563eb' }}
                    title="View full details"
                  >
                    {u.username}
                  </strong>
                  <Badge>Pending</Badge>
                </div>
              </Td>
              <Td>{u.email || '—'}</Td>
              <Td>{new Date(u.date_joined).toLocaleString()}</Td>
              <Td>
                <button onClick={() => approve(u.id)} style={{ padding: '6px 10px', border: '1px solid #059669', borderRadius: 8, background: '#10b981', color: '#fff', cursor: 'pointer', marginRight: 8 }}>Approve</button>
                <button onClick={() => deny(u.id)} style={{ padding: '6px 10px', border: '1px solid #dc2626', borderRadius: 8, background: '#ef4444', color: '#fff', cursor: 'pointer', marginRight: 8 }}>Deny</button>
                <button onClick={() => setSelected(u)} style={{ padding: '6px 10px', border: '1px solid #6b7280', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Request changes</button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Detail modal */}
      {detailUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div style={{ width: 'min(640px, 96vw)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {detailUser.profile?.profile_image_url && (
                <img src={detailUser.profile.profile_image_url} alt={detailUser.username} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', border: '1px solid #e5e7eb' }} />
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>{detailUser.username}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <Badge color="#92400e" bg="#fef3c7">Pending</Badge>
                  {detailUser.is_staff && <Badge color="#1e3a8a" bg="#dbeafe">Staff</Badge>}
                  {!detailUser.is_active && <Badge color="#991b1b" bg="#fee2e2">Inactive</Badge>}
                </div>
              </div>
              <button onClick={() => setDetailUser(null)} style={{ background: 'transparent', border: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
              <Info label="Email" value={detailUser.email} />
              <Info label="First name" value={detailUser.first_name} />
              <Info label="Last name" value={detailUser.last_name} />
              <Info label="Joined" value={new Date(detailUser.date_joined).toLocaleString()} />
              <Info label="AFM" value={detailUser.profile?.afm} />
              <Info label="Phone" value={detailUser.profile?.phone_number} />
              <Info label="DOB" value={detailUser.profile?.date_of_birth} />
              <Info label="Active" value={detailUser.is_active ? 'Yes' : 'No'} />
            </div>
            {detailUser.profile?.bio && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 6px' }}>Bio</h4>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detailUser.profile.bio}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 8 }}>
              <button onClick={() => setDetailUser(null)} style={{ padding: '8px 14px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8 }}>Close</button>
              <button onClick={() => { approve(detailUser.id); setDetailUser(null); }} style={{ padding: '8px 14px', border: '1px solid #059669', background: '#10b981', color: '#fff', borderRadius: 8 }}>Approve</button>
              <button onClick={() => { deny(detailUser.id); setDetailUser(null); }} style={{ padding: '8px 14px', border: '1px solid #dc2626', background: '#ef4444', color: '#fff', borderRadius: 8 }}>Deny</button>
              <button onClick={() => { setSelected(detailUser); setDetailUser(null); }} style={{ padding: '8px 14px', border: '1px solid #6b7280', background: '#fff', borderRadius: 8 }}>Request changes</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(620px, 96vw)', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
            <h3>Request changes for {selected.username}</h3>
            <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what needs to be corrected..." style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setSelected(null)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8 }}>Cancel</button>
              <button onClick={async () => { await requestChanges(selected.id, note); setSelected(null); setNote('') }} style={{ padding: '8px 12px', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: 8 }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for label/value display
const Info = ({ label, value }) => (
  <div style={{ fontSize: 13 }}>
    <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>{label}</div>
    <div style={{ color: '#111827' }}>{value || '—'}</div>
  </div>
)

export default AdminRegistrations

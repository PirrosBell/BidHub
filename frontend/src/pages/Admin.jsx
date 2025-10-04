import React from 'react'
import { Link } from 'react-router-dom'
import '../styles/Admin.css'

const Admin = () => {
  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Administrator Dashboard</h1>
        <p className="subtitle">Welcome back. Choose a management area below.</p>
      </div>

      <div className="admin-grid">
        <Link to="/admin/users" className="admin-card">
          <div className="card-icon users" aria-hidden="true">👥</div>
          <h2>User Directory</h2>
          <p>View and manage all registered users, roles, and statuses.</p>
          <span className="card-link">Go to Users →</span>
        </Link>

        <Link to="/admin/registrations" className="admin-card">
          <div className="card-icon pending" aria-hidden="true">📝</div>
          <h2>Pending Approvals</h2>
          <p>Review newly registered accounts awaiting approval.</p>
          <span className="card-link">Review Registrations →</span>
        </Link>
      </div>
    </div>
  )
}

export default Admin
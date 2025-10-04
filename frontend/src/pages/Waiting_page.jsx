import React from 'react'
import '../styles/WaitingRoom.css'

const WaitRoom = () => {
  return (
    <div className="wait-page">
      <div className="wait-card">
        <h1>Account Pending Approval</h1>
        <p className="wait-message">
          Thank you for registering. Your account is currently under review by an administrator.
        </p>
        <div className="status-row">
          <div className="spinner" aria-hidden="true" />
          <span className="status-text">Please wait, you will gain full access once approved.</span>
        </div>
        <p className="hint">You may close this page and return later. Try logging in periodically to check if you have been approved.</p>
      </div>
    </div>
  )
}

export default WaitRoom
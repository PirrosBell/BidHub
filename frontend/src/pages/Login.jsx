import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/LoginScreen.css'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading } = useAuth()
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    remember: false
  })

  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!loginForm.username || !loginForm.password) {
      setMessage('Please fill in all fields')
      return
    }

    setMessage('')
    
    try {
      const result = await login(loginForm.username, loginForm.password)
      
      if (result.success) {
        let destination = '/home'
        try {
          const access = localStorage.getItem('accessToken')
          if (access) {
            const resp = await fetch(`${window?.location?.origin ? `http://localhost:8000/api/` : ''}auth/profile/`, {
              headers: { 'Authorization': `Bearer ${access}`, 'Content-Type': 'application/json' }
            })
            if (resp.ok) {
              const profile = await resp.json()
              if (profile?.is_staff || profile?.is_superuser) {
                destination = '/admin'
              }
            }
          }
        } catch (_) {}
        navigate(destination, { replace: true })
      } else {
        setMessage(result.error || 'Login failed. Please check your credentials.')
      }
    } catch (error) {
      setMessage('An error occurred during login. Please try again.')
      console.error('Login error:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setLoginForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Auction Platform</h1>
          <p>Sign in to your account</p>
        </div>
        
        {message && (
          <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Username or Email"
              value={loginForm.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <div className="login-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={loginForm.remember}
                  onChange={(e) => handleInputChange('remember', e.target.checked)}
                />
                <span className="checkmark"></span>
                Remember me
              </label>
              <a href="#" className="forgot-password">
                Forgot password?
              </a>
            </div>
          </div>
          
          <div className="form-group">
            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
          
          <div className="signup-link">
            Don't have an account? <a href="/register">Sign up</a>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
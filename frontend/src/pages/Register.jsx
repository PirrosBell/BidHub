import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CountryDropdown } from 'react-country-region-selector';
import '../styles/LoginScreen.css'

const Register = () => {
  const navigate = useNavigate()
  const { register, isLoading } = useAuth()
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    afm: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })

  const countries = [
    'United States','Canada','United Kingdom','Germany','France','Greece','Spain','Italy','Australia','Netherlands','Sweden','Norway','Denmark','Finland','Switzerland','Austria','Belgium','Ireland','Portugal','Poland','Czech Republic','Hungary','Romania','Bulgaria','Croatia','Serbia','Turkey','Cyprus','Luxembourg','Iceland','New Zealand','Japan','China','India','Brazil','Mexico','South Africa','Nigeria','Kenya','Egypt','United Arab Emirates','Saudi Arabia','Israel','Russia','Ukraine','Argentina','Chile','Colombia','Peru','Singapore','Malaysia','Thailand','Vietnam','Philippines','Indonesia','South Korea','Taiwan','Hong Kong','Pakistan','Bangladesh','Sri Lanka','Nepal','Other'
  ]

  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.password_confirm || !registerForm.afm || !registerForm.phone_number || !registerForm.address_line1 || !registerForm.city || !registerForm.postal_code || !registerForm.country) {
      setMessage('Please fill in all required fields, including AFM, phone, and full address')
      return
    }

    if (registerForm.password !== registerForm.password_confirm) {
      setMessage('Passwords do not match')
      return
    }

    if (registerForm.password.length < 8) {
      setMessage('Password must be at least 8 characters long')
      return
    }

    if (!/^[0-9]{9}$/.test(registerForm.afm)) {
      setMessage('AFM must be numeric and 9 digits')
      return
    }

    setMessage('')
    try {
      const result = await register(registerForm)
      if (result.success) {
        navigate('/waiting_page')
        return
      } else {
        setMessage(result.error || 'Registration failed. Please try again.')
      }
    } catch (error) {
      setMessage('An error occurred during registration. Please try again.')
      console.error('Registration error:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setRegisterForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Create Account</h1>
          <p>Sign up for Auction Platform</p>
        </div>
        {message && (
          <div className={`message ${message.includes('submitted') ? 'success' : message.includes('Awaiting') ? 'success' : message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Username *"
              value={registerForm.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email *"
              value={registerForm.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="First Name"
              value={registerForm.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Last Name"
              value={registerForm.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="AFM (Tax ID) *"
              value={registerForm.afm}
              onChange={(e) => handleInputChange('afm', e.target.value)}
              className="form-input"
              required
              inputMode="numeric"
              pattern="[0-9]{9}"
              title="AFM must be numeric and 9 digits"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password *"
              value={registerForm.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Confirm Password *"
              value={registerForm.password_confirm}
              onChange={(e) => handleInputChange('password_confirm', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Phone Number *"
              value={registerForm.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Address Line 1 *"
              value={registerForm.address_line1}
              onChange={(e) => handleInputChange('address_line1', e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Address Line 2"
              value={registerForm.address_line2}
              onChange={(e) => handleInputChange('address_line2', e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-row" style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              placeholder="City *"
              value={registerForm.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className="form-input"
              required
              style={{ flex:1 }}
            />
            <input
              type="text"
              placeholder="State/Region"
              value={registerForm.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className="form-input"
              style={{ flex:1 }}
            />
          </div>
          <div className="form-row" style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              placeholder="Postal Code *"
              value={registerForm.postal_code}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
              className="form-input"
              required
              style={{ flex:1 }}
            />
          </div>
          <div className="form-group">
            <CountryDropdown
              value={registerForm.country}
              onChange={(val) => handleInputChange('country', val)}
              valueType="short"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
          <div className="signup-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register
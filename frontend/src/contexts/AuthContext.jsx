import React, { createContext, useContext, useState, useEffect } from 'react';
import { BACKEND_ADDRESS } from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!accessToken || !refreshToken) {
      setIsLoading(false);
      return;
    }
    try {
      let response = await fetch(`${BACKEND_ADDRESS}auth/profile/`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (response.status === 401) {
        const refreshResponse = await fetch(`${BACKEND_ADDRESS}token/refresh/`, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('accessToken', data.access);
          response = await fetch(`${BACKEND_ADDRESS}auth/profile/`, {
            headers: { 'Authorization': `Bearer ${data.access}`, 'Content-Type': 'application/json' },
          });
        }
      }
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } catch (_) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { checkAuth(); }, []);

  const login = async (username, password) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_ADDRESS}auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      const data = await response.json();
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      setUser({ id: data.user_id, username: data.username, email: data.email });
      setIsAuthenticated(true);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await checkAuth();
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_ADDRESS}auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await response.json();
      if (!response.ok) {
        let message = data?.detail || 'Registration failed';
        if (data && typeof data === 'object') {
          const fieldErrors = [];
          for (const [field, errors] of Object.entries(data)) {
            if (Array.isArray(errors)) fieldErrors.push(`${field}: ${errors.join(', ')}`);
            else fieldErrors.push(`${field}: ${errors}`);
          }
          if (fieldErrors.length) message = fieldErrors.join('; ');
        }
        throw new Error(message);
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const getToken = () => localStorage.getItem('accessToken');

  const value = { user, isAuthenticated, isLoading, login, logout, register, getToken };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
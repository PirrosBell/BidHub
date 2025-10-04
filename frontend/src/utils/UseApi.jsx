import { useState, useEffect, useRef } from 'react';
import { BACKEND_ADDRESS } from '../config';

const useApi = (endpoint, method = 'GET', body = null, auto = true) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(auto);
  const [meta, setMeta] = useState(null);
  const currentRequestRef = useRef(0);

  const fetchData = async (overrideBody = null) => {
    const effectiveBody = overrideBody ?? body;
    const requestId = ++currentRequestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const buildConfig = (accessToken) => {
        const cfg = {
          method,
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        };
        if (!(effectiveBody instanceof FormData)) cfg.headers['Content-Type'] = 'application/json';
        if (accessToken) cfg.headers['Authorization'] = `Bearer ${accessToken}`;
        if (effectiveBody) {
          if (effectiveBody instanceof FormData) cfg.body = effectiveBody; 
          else if (['POST', 'PUT', 'PATCH'].includes(method)) cfg.body = JSON.stringify(effectiveBody);
        }
        return cfg;
      };

      const refreshAccessToken = async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return null;
        const resp = await fetch(`${BACKEND_ADDRESS}token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json','Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data?.access) {
          localStorage.setItem('accessToken', data.access);
          return data.access;
        }
        return null;
      };

      let accessToken = localStorage.getItem('accessToken');
      let response = await fetch(`${BACKEND_ADDRESS}${endpoint}`, buildConfig(accessToken));
      if (requestId !== currentRequestRef.current) return;
      if (response.status === 401) {
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          accessToken = newAccess;
          response = await fetch(`${BACKEND_ADDRESS}${endpoint}`, buildConfig(accessToken));
          if (requestId !== currentRequestRef.current) return;
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMessage = errorData.detail;
          else if (errorData.error) errorMessage = errorData.error;
          else if (errorData.message) errorMessage = errorData.message;
          else if (typeof errorData === 'string') errorMessage = errorData;
          else {
            const fieldErrors = [];
            for (const [field, errors] of Object.entries(errorData)) {
              if (Array.isArray(errors)) fieldErrors.push(`${field}: ${errors.join(', ')}`);
              else fieldErrors.push(`${field}: ${errors}`);
            }
            if (fieldErrors.length > 0) errorMessage = fieldErrors.join('; ');
          }
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        const err = new Error(errorMessage);
        err.status = response.status;
        setError(err.message);
        throw err;
      }

      if (method === 'DELETE') {
        setData({ success: true });
        return;
      }

      const jsonData = await response.json();
      if (requestId !== currentRequestRef.current) return;
      if (jsonData.results) {
        setData(jsonData.results);
        setMeta({ count: jsonData.count, next: jsonData.next, previous: jsonData.previous });
      } else {
        setData(jsonData);
        setMeta(null);
      }
    } catch (err) {
      if (requestId === currentRequestRef.current) {
        console.error('Fetch error:', err);
        setError(err.message || 'An error occurred');
        throw err;
      }
    } finally {
      if (requestId === currentRequestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (auto && endpoint) fetchData();
    return () => { currentRequestRef.current++; };
  }, [endpoint, method, JSON.stringify(body), auto]);

  return { data, meta, error, isLoading, refetch: fetchData };
};

export default useApi;
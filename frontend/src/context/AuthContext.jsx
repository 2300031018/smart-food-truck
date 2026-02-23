import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sft_token') || null);
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('sft_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      // Sync user profile on load/token change
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data?.user) {
            const updatedUser = { ...user, ...res.data.user };
            setUser(updatedUser);
            localStorage.setItem('sft_user', JSON.stringify(updatedUser));
          }
        })
        .catch(err => console.warn('User sync failed', err));
    }
  }, [token]);

  function login(tokenValue, userValue) {
    setToken(tokenValue);
    setUser(userValue);
    localStorage.setItem('sft_token', tokenValue);
    localStorage.setItem('sft_user', JSON.stringify(userValue));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sft_token');
    localStorage.removeItem('sft_user');
  }

  const value = { token, user, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

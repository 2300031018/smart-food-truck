import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sft_token') || null);
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('sft_user');
    return raw ? JSON.parse(raw) : null;
  });

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

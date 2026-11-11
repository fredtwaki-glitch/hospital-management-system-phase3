import { createContext, ReactNode, useContext, useState } from 'react';
import { api, clearAuth, isAuthenticated, setAuth } from '../lib/api';
import { StaffUser } from '../lib/types';

interface AuthContextValue {
  isLoggedIn: boolean;
  staffUser: StaffUser | null;
  tenantSlug: string;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => {
    const stored = localStorage.getItem('staffUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [tenantSlug, setTenantSlug] = useState(localStorage.getItem('tenantSlug') || '');

  async function login(slug: string, email: string, password: string) {
    // setAuth needs the tenant slug in localStorage BEFORE calling the
    // API, since the api client reads it from storage on every request.
    setAuth(slug, '');
    const result = await api.post<{ accessToken: string; user: StaffUser }>('/auth/login', { email, password });
    setAuth(slug, result.accessToken);
    localStorage.setItem('staffUser', JSON.stringify(result.user));
    setStaffUser(result.user);
    setTenantSlug(slug);
    setIsLoggedIn(true);
  }

  function logout() {
    clearAuth();
    setIsLoggedIn(false);
    setStaffUser(null);
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, staffUser, tenantSlug, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

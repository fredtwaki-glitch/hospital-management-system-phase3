import { createContext, ReactNode, useContext, useState } from 'react';
import { api, clearPatientAuth, isPatientAuthenticated, setPatientToken, setTenantSlug } from '../lib/api';

interface AuthContextValue {
  isLoggedIn: boolean;
  requestCode: (tenantSlug: string, email: string, mrn: string) => Promise<void>;
  verifyCode: (tenantSlug: string, email: string, mrn: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(isPatientAuthenticated());

  async function requestCode(tenantSlug: string, email: string, mrn: string) {
    setTenantSlug(tenantSlug);
    await api.post('/patient-portal/auth/request-code', { email, mrn });
  }

  async function verifyCode(tenantSlug: string, email: string, mrn: string, code: string) {
    setTenantSlug(tenantSlug);
    const result = await api.post<{ accessToken: string }>('/patient-portal/auth/verify-code', { email, mrn, code });
    setPatientToken(result.accessToken);
    setIsLoggedIn(true);
  }

  function logout() {
    clearPatientAuth();
    setIsLoggedIn(false);
  }

  return <AuthContext.Provider value={{ isLoggedIn, requestCode, verifyCode, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

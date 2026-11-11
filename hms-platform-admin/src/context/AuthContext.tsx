import { createContext, ReactNode, useContext, useState } from 'react';
import { api, clearPlatformToken, isPlatformAuthenticated, setPlatformToken } from '../lib/api';

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(isPlatformAuthenticated());

  async function login(email: string, password: string) {
    const result = await api.post<{ accessToken: string }>('/platform/auth/login', { email, password });
    setPlatformToken(result.accessToken);
    setIsLoggedIn(true);
  }

  function logout() {
    clearPlatformToken();
    setIsLoggedIn(false);
  }

  return <AuthContext.Provider value={{ isLoggedIn, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

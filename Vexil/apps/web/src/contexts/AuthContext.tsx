import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vexil_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.me()
      .then((u) => setUser(u as AuthUser))
      .catch(() => { localStorage.removeItem('vexil_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('vexil_token', res.token);
    setToken(res.token);
    setUser(res.user as AuthUser);
  };

  const register = async (name: string, email: string, password: string, orgName: string) => {
    const res = await api.register(name, email, password, orgName);
    localStorage.setItem('vexil_token', res.token);
    setToken(res.token);
    setUser(res.user as AuthUser);
  };

  const logout = () => {
    localStorage.removeItem('vexil_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authVerifyQueryOptions } from '@/data/queries/auth';
import { User } from '@/data/api/auth/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (newToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const navigate = useNavigate();

  // Use TanStack Query for token verification
  const { data, isLoading, error } = useQuery({
    ...authVerifyQueryOptions(),
    enabled: !!token, // Only run if token exists
  });

  // Update user when query succeeds
  useEffect(() => {
    if (data) {
      setUser(data.user);
    }
  }, [data]);

  // Handle auth errors
  useEffect(() => {
    if (error && token) {
      console.error('Token verification failed:', error);
      logout();
    }
  }, [error, token]);

  function login(newToken: string) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        // User is authenticated if we have both a token and user
        isAuthenticated: !!token && !!user,
        loading: isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

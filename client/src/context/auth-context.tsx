import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authVerifyQueryOptions } from '@/data/queries/auth';
import { User } from '@/data/api/auth/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (newToken: string, userData: User) => void;
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

  function login(newToken: string, userData: User) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        // User is authenticated if we have a user, OR if we have data from the query
        // This prevents the race condition where query completes but useEffect hasn't run yet
        isAuthenticated: !!user || !!data,
        loading: isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

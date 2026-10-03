'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User, setAuthToken, getAuthToken, API_BASE } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGitHub: () => void;
  loginWithGoogle: () => void;
  loginWithDemo: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // 1. Check for token in URL query (from OAuth redirects)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setAuthToken(urlToken);
        // Clean URL without triggering page reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

    // 2. Fetch authenticated user profile
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function refreshUser() {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const u = await api.getMe();
      setUser(u);
    } catch {
      // Token expired or invalid
      setAuthToken(null);
      setUser(null);
    }
  }

  function loginWithGitHub() {
    window.location.href = `${API_BASE}/api/v1/auth/github`;
  }

  function loginWithGoogle() {
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }

  async function loginWithDemo() {
    try {
      setLoading(true);
      const res = await api.demoLogin();
      setUser(res.user);
      setIsAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail(email: string, password: string): Promise<User> {
    try {
      setLoading(true);
      const res = await api.loginWithEmail(email, password);
      setUser(res.user);
      setIsAuthModalOpen(false);
      return res.user;
    } finally {
      setLoading(false);
    }
  }

  async function registerWithEmail(email: string, password: string, name?: string): Promise<User> {
    try {
      setLoading(true);
      const res = await api.registerWithEmail(email, password, name);
      setUser(res.user);
      setIsAuthModalOpen(false);
      return res.user;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // continue
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        loginWithGitHub,
        loginWithGoogle,
        loginWithDemo,
        loginWithEmail,
        registerWithEmail,
        logout,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

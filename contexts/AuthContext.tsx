/**
 * Auth Context
 *
 * Provides global auth state (current user, loading) to the entire app.
 * When a user is signed in, also subscribes to their Firestore credit balance.
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import {
  onAuthStateChanged,
  type BrickUser,
} from '../services/authService';

interface AuthState {
  user: BrickUser | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BrickUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

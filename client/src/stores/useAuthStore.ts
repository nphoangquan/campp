import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Where a guest page should send the user once they are signed in. */
  nextPath: string | null;
  setAuth: (user: User, accessToken: string, nextPath?: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  setUserStatus: (status: User['status']) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  nextPath: null,
  setAuth: (user, accessToken, nextPath) =>
    set({ user, accessToken, isAuthenticated: true, isLoading: false, nextPath: nextPath ?? null }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUserStatus: (status) =>
    set((s) => (s.user ? { user: { ...s.user, status } } : s)),
  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, nextPath: null }),
  setLoading: (isLoading) => set({ isLoading }),
}));

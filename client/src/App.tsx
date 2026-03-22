import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './stores/useAuthStore';

import { authApi } from './services/api/auth.api';
import { setDesktopNotificationsEnabled } from './hooks/useNotifications';
import AppLoader from './components/ui/AppLoader';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AppPage from './pages/AppPage';
import InvitePage from './pages/InvitePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  const { setAuth, logout, setLoading, isLoading } = useAuthStore();

  // Kiem tra session khi app load: refresh truoc de co token, roi getMe
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || '/api';
    const refreshUrl = BASE.replace(/\/$/, '') + '/auth/refresh-token';

    fetch(refreshUrl, { method: 'POST', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.accessToken) {
          useAuthStore.getState().setAccessToken(data.accessToken);
          return authApi.getMe();
        }
        throw new Error('No token');
      })
      .then(({ user }) => {
        if (user.desktopNotifications === false) {
          setDesktopNotificationsEnabled(false);
        }
        setAuth(user, useAuthStore.getState().accessToken!);
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setAuth, logout, setLoading]);

  useEffect(() => {
    document.documentElement.classList.toggle('app-loading', isLoading);
    return () => document.documentElement.classList.remove('app-loading');
  }, [isLoading]);

  if (isLoading) {
    return (
      <>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#222229',
              border: '1px solid #33333d',
              color: '#B5BAC1',
            },
          }}
        />
        <AppLoader />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#222229',
            border: '1px solid #33333d',
            color: '#B5BAC1',
          },
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password/verify"
          element={
            <GuestRoute>
              <VerifyOtpPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password/reset"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/channels"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/@me"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/@me/:conversationId"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:serverId"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:serverId/:channelId"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />
        <Route path="/invite/:code" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/channels" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

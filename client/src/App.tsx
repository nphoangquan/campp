import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './stores/useAuthStore';
import { useTheme } from './hooks/useTheme';

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
import WelcomePage from './pages/WelcomePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, nextPath } = useAuthStore();
  // Signing in on a guest page re-renders this route before the page's own
  // navigate lands, so honour the page's intended destination here.
  return isAuthenticated ? <Navigate to={nextPath || '/'} replace /> : <>{children}</>;
}

export default function App() {
  const { setAuth, logout, setLoading, isLoading } = useAuthStore();
  const { resolved: resolvedTheme } = useTheme();

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
          theme={resolvedTheme}
          toastOptions={{
            style: {
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: '2px',
              color: 'var(--fg)',
              fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
              fontSize: '15px',
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
        theme={resolvedTheme}
        toastOptions={{
          style: {
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: '2px',
              color: 'var(--fg)',
              fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
              fontSize: '15px',
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
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          }
        />
        <Route path="/invite/:code" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/channels" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { useCallback, useEffect, useState } from 'react';

const NOTIFICATION_PERMISSION_KEY = 'camp-notification-permission-requested';
const DESKTOP_NOTIFICATIONS_ENABLED_KEY = 'camp-desktop-notifications-enabled';

function getDesktopNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY);
  return v !== 'false'; // default true for backward compat
}

export function setDesktopNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function useNotifications() {
  const [enabled, setEnabled] = useState(getDesktopNotificationsEnabled);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      setDesktopNotificationsEnabled(true);
      setEnabled(true);
      return true;
    }
    if (Notification.permission === 'denied') return false;
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setDesktopNotificationsEnabled(true);
        setEnabled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const disableNotifications = useCallback(() => {
    setDesktopNotificationsEnabled(false);
    setEnabled(false);
  }, []);

  const showNotification = useCallback((title: string, options?: { body?: string; tag?: string }) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!getDesktopNotificationsEnabled()) return;
    if (document.visibilityState === 'visible') return;

    try {
      new Notification(title, {
        body: options?.body,
        tag: options?.tag ?? 'camp-message',
        icon: '/favicon.ico',
      });
    } catch {
      // Ignore notification errors
    }
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    const requested = sessionStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    if (!requested && Notification.permission === 'default') {
      sessionStorage.setItem(NOTIFICATION_PERMISSION_KEY, '1');
    }
  }, []);

  return { requestPermission, disableNotifications, showNotification, enabled, permission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null };
}

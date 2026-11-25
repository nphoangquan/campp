import { useCallback, useEffect, useState } from 'react';
import { notificationApi } from '../services/api/notification.api';

export interface ServerSignal {
  unread: number;
  mentions: number;
}

const idOf = (v: string | { _id: string } | undefined) => (typeof v === 'string' ? v : v?._id);

/**
 * Unread and mention totals per server, for the server rail. Refreshed when the
 * active server changes, when the window regains focus, and every 30 seconds.
 */
export function useServerSignals(activeServerId?: string | null) {
  const [signals, setSignals] = useState<Record<string, ServerSignal>>({});

  const refresh = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([
        notificationApi.getNotifications('unreads'),
        notificationApi.getNotifications('mentions'),
      ]);
      const next: Record<string, ServerSignal> = {};
      for (const item of u.unreads ?? []) {
        const s = (next[item.serverId] ??= { unread: 0, mentions: 0 });
        s.unread += item.unreadCount;
      }
      for (const n of m.notifications ?? []) {
        const sid = idOf(n.serverId);
        if (!sid || n.read) continue;
        const s = (next[sid] ??= { unread: 0, mentions: 0 });
        s.mentions += 1;
      }
      setSignals(next);
    } catch {
      /* rail signals are best effort */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, activeServerId]);

  useEffect(() => {
    const t = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return signals;
}

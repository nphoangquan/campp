import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../services/api/notification.api';
import type { NotificationItem } from '../../services/api/notification.api';
import { useUIStore } from '../../stores/useUIStore';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'for-you' | 'unreads' | 'mentions';

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export default function InboxPanel({ anchorRef, onClose }: Props) {
  const navigate = useNavigate();
  const { setShowUserSettings } = useUIStore();
  const [tab, setTab] = useState<Tab>('mentions');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [countRes, dataRes] = await Promise.all([
        notificationApi.getUnreadCount(),
        notificationApi.getNotifications(tab),
      ]);
      setUnreadCount(countRes.count);
      if ((tab === 'mentions' || tab === 'unreads') && dataRes.notifications) {
        setNotifications(dataRes.notifications);
      } else if (tab === 'for-you') {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  const handleJumpToMessage = (n: NotificationItem) => {
    const serverId = typeof n.serverId === 'object' ? n.serverId?._id : n.serverId;
    const channelId = typeof n.channelId === 'object' ? n.channelId?._id : n.channelId;
    if (serverId && channelId) {
      navigate(`/channels/${serverId}/${channelId}`);
      onClose();
    }
  };

  const handleOpenNotificationSettings = () => {
    setShowUserSettings(true);
    onClose();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      loadData();
    } catch {
      // ignore
    }
  };

  const rect = anchorRef.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 8 : 56;
  const right = 16;

  const content = (
    <div
      ref={panelRef}
      className="fixed z-[100] w-[400px] max-h-[480px] bg-layer-1 rounded-lg shadow-xl flex flex-col overflow-hidden border border-layer-5"
      style={{ top, right }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-layer-4 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#80848E]" />
          <span className="text-white font-semibold text-base">Inbox</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#80848E] text-sm">{unreadCount}</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors cursor-pointer"
              title="Mark all as read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleOpenNotificationSettings}
            className="p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors cursor-pointer"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-layer-4 shrink-0">
        {(['for-you', 'unreads', 'mentions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
              tab === t
                ? 'text-white border-b-2 border-accent-500'
                : 'text-[#80848E] hover:text-white hover:bg-layer-3'
            }`}
          >
            {t === 'for-you' ? 'For You' : t === 'unreads' ? 'Unreads' : 'Mentions'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {loading ? (
          <div className="p-6 text-center text-[#80848E] text-sm">Loading...</div>
        ) : tab === 'for-you' ? (
          <div className="p-8 text-center">
            <p className="text-[#80848E] text-sm">Nothing here yet</p>
            <p className="text-[#80848E] text-xs mt-1">Come back for notifications on events and more.</p>
          </div>
        ) : tab === 'unreads' ? (
          notifications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#80848E] text-sm">You are all caught up</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((n) => (
                <div key={n._id} className="px-4 py-2.5 hover:bg-layer-3 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {n.authorId?.avatar ? (
                        <img src={n.authorId.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {n.authorId?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="font-medium">{n.authorId?.displayName ?? 'Someone'}</span>
                        <span className="text-[#80848E]">
                          {' '}
                          {n.type === 'everyone'
                            ? 'mentioned @everyone'
                            : n.type === 'here'
                              ? 'mentioned @here'
                              : 'mentioned you'}{' '}
                        </span>
                        <span className="text-[#80848E]">in</span>
                        <span className="text-accent-400">
                          {' '}
                          #{typeof n.channelId === 'object' ? n.channelId?.name : 'channel'}
                        </span>
                        {n.serverId && typeof n.serverId === 'object' && (
                          <span className="text-[#80848E]"> in {n.serverId.name}</span>
                        )}
                      </p>
                      <p className="text-[#80848E] text-xs mt-0.5">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                      {(typeof n.serverId === 'object' ? n.serverId?._id : n.serverId) &&
                        (typeof n.channelId === 'object' ? n.channelId?._id : n.channelId) && (
                          <button
                            onClick={() => handleJumpToMessage(n)}
                            className="mt-1.5 text-accent-400 hover:text-accent-300 text-xs font-medium cursor-pointer"
                          >
                            Jump
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#80848E] text-sm">No mentions yet</p>
          </div>
        ) : (
          <div className="py-2">
            {notifications.map((n) => (
              <div
                key={n._id}
                className={`px-4 py-2.5 hover:bg-layer-3 transition-colors ${!n.read ? 'bg-layer-3/50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {n.authorId?.avatar ? (
                      <img src={n.authorId.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {n.authorId?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">
                      <span className="font-medium">{n.authorId?.displayName ?? 'Someone'}</span>
                      <span className="text-[#80848E]">
                        {' '}
                        {n.type === 'everyone' ? 'mentioned @everyone' : 'mentioned you'}{' '}
                      </span>
                      <span className="text-[#80848E]">in</span>
                      <span className="text-accent-400">
                        {' '}
                        #{typeof n.channelId === 'object' ? n.channelId?.name : 'channel'}
                      </span>
                      {n.serverId && typeof n.serverId === 'object' && (
                        <span className="text-[#80848E]"> in {n.serverId.name}</span>
                      )}
                    </p>
                    <p className="text-[#80848E] text-xs mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                    {(typeof n.serverId === 'object' ? n.serverId?._id : n.serverId) &&
                      (typeof n.channelId === 'object' ? n.channelId?._id : n.channelId) && (
                      <button
                        onClick={() => handleJumpToMessage(n)}
                        className="mt-1.5 text-accent-400 hover:text-accent-300 text-xs font-medium cursor-pointer"
                      >
                        Jump
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

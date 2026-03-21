import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { notificationApi } from '../../services/api/notification.api';
import InboxPanel from './InboxPanel';

export default function InboxButton() {
  const { showInbox, setShowInbox } = useUIStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    notificationApi.getUnreadCount().then(({ count }) => setUnreadCount(count));
  }, [showInbox]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setShowInbox(!showInbox)}
        className="relative p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:ring-offset-2 focus:ring-offset-layer-2"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-danger-500 text-white text-2xs font-bold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {showInbox && (
        <InboxPanel
          anchorRef={buttonRef}
          onClose={() => setShowInbox(false)}
        />
      )}
    </>
  );
}

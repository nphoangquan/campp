import { useEffect, useState, useRef } from 'react';
import { Users, MessageSquare, X, UserCircle, LogOut } from 'lucide-react';
import { useDMStore } from '../../stores/useDMStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { dmApi } from '../../services/api/dm.api';
import { getSocket } from '../../services/socket/socketService';
import { formatDistanceToNowStrict } from 'date-fns';
import UserSettings from '../layout/UserSettings';

interface Props {
  view: 'friends' | 'dm' | 'conversation';
  currentConversationId: string | null;
  onSelectFriends: () => void;
  onSelectConversation: (conversationId: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}

export default function DMSidebar({ view, currentConversationId, onSelectFriends, onSelectConversation, onLogout: _onLogout, onClose }: Props) {
  const { conversations, setConversations, incoming } = useDMStore();
  const user = useAuthStore((s) => s.user);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const showUserSettings = useUIStore((s) => s.showUserSettings);
  const setShowUserSettings = useUIStore((s) => s.setShowUserSettings);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    dmApi.getConversations()
      .then(({ conversations: c }) => setConversations(c))
      .catch(console.error);
  }, [setConversations]);

  const getOtherParticipant = (conv: typeof conversations[0]) =>
    conv.participants.find((p) => p._id !== user?._id) || conv.participants[0];

  const statusColor: Record<string, string> = {
    online: 'bg-online', idle: 'bg-idle', dnd: 'bg-dnd', offline: 'bg-[#80848E]', invisible: 'bg-[#80848E]',
  };

  return (
    <div className="w-60 shrink-0 bg-layer-1 flex flex-col">
      {/* Search placeholder + close button */}
      <div className="h-12 px-3 flex items-center gap-2 border-b border-layer-3 shadow-sm">
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden shrink-0 p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors"
            aria-label="Close direct messages"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button className="flex-1 min-w-0 bg-layer-0 rounded px-2 py-1.5 text-[#80848E] text-sm text-left cursor-pointer hover:bg-layer-3 transition-colors">
          Find or start a conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {/* Friends button */}
        <button
          onClick={onSelectFriends}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
            view === 'friends' ? 'bg-layer-4 text-white' : 'text-[#B5BAC1] hover:text-white hover:bg-layer-3'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-sm font-medium">Friends</span>
          {incoming.length > 0 && (
            <span className="ml-auto bg-danger-500 text-white text-2xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {incoming.length}
            </span>
          )}
        </button>

        {/* DM section header */}
        <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-2 mt-4 mb-1">
          Direct Messages
        </p>

        {/* Conversations */}
        {conversations.map((conv) => {
          const other = getOtherParticipant(conv);
          const isActive = currentConversationId === conv._id;
          return (
            <button
              key={conv._id}
              onClick={() => onSelectConversation(conv._id)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                isActive ? 'bg-layer-4' : 'hover:bg-layer-3'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
                  {other.avatar ? (
                    <img src={other.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">{other.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColor[other.status] || statusColor.offline} border-2 border-layer-1 rounded-full`} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-[#B5BAC1]'}`}>
                  {other.displayName}
                </p>
                {conv.lastMessage && !conv.lastMessage.deleted && (
                  <p className="text-[#80848E] text-2xs truncate">
                    {conv.lastMessage.content || 'Sent an attachment'}
                  </p>
                )}
              </div>
              {conv.lastMessage && (
                <span className="text-[#5C5F66] text-2xs shrink-0">
                  {formatDistanceToNowStrict(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                </span>
              )}
            </button>
          );
        })}

        {conversations.length === 0 && (
          <div className="text-center py-8 px-2">
            <MessageSquare className="w-8 h-8 text-[#5C5F66] mx-auto mb-2" />
            <p className="text-[#5C5F66] text-xs">No conversations yet</p>
          </div>
        )}
      </div>

      {/* User bar */}
      <div className="h-[52px] bg-layer-0 px-2 flex items-center gap-2 relative" ref={statusMenuRef}>
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">{user?.displayName?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-layer-0 rounded-full ${statusColor[user?.status || 'offline'] || statusColor.offline}`} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-[#80848E] text-xs truncate">@{user?.username}</p>
          </div>
        </button>
        {showStatusMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-layer-1 rounded-lg shadow-xl py-1.5 z-50 border border-layer-5">
            <button
              onClick={() => { setShowUserSettings(true); setShowStatusMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-[#B5BAC1] hover:bg-layer-4 hover:text-white cursor-pointer transition-colors"
            >
              <UserCircle className="w-4 h-4" />
              User Settings
            </button>
            <div className="mx-2 my-1 border-t border-layer-5" />
            {(['online', 'idle', 'dnd', 'invisible'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  getSocket()?.emit('updateStatus', s);
                  useAuthStore.getState().setUserStatus(s);
                  setShowStatusMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-[#B5BAC1] hover:bg-layer-4 hover:text-white cursor-pointer transition-colors"
              >
                <div className={`w-3 h-3 rounded-full shrink-0 ${statusColor[s]}`} />
                <span className="capitalize">{s === 'dnd' ? 'Do Not Disturb' : s}</span>
              </button>
            ))}
            <div className="mx-2 my-1 border-t border-layer-5" />
            <button
              onClick={() => {
                setShowStatusMenu(false);
                _onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-danger-400 hover:bg-danger-500/10 hover:text-danger-400 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        )}
      </div>
      {showUserSettings && <UserSettings onClose={() => setShowUserSettings(false)} />}
    </div>
  );
}

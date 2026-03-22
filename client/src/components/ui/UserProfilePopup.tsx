import { useEffect, useRef } from 'react';
import { MessageSquare, UserPlus, X, Pencil } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { useDMStore } from '../../stores/useDMStore';
import { dmApi } from '../../services/api/dm.api';
import { friendApi } from '../../services/api/friend.api';
import { toast } from 'sonner';
import type { User } from '../../types';

const MEMBER_LIST_WIDTH = 240;
const POPUP_GAP = 20;
const POPUP_WIDTH = 300;
const BANNER_HEIGHT = 100;
const DEFAULT_BANNER_COLOR = '#1a1a21';

function getBannerStyle(banner?: string): React.CSSProperties {
  if (!banner) return { backgroundColor: DEFAULT_BANNER_COLOR };
  if (banner.startsWith('http') || banner.startsWith('data:')) {
    return { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundColor: banner };
}

interface Props {
  user: User;
  position?: { x: number; y: number };
  onClose: () => void;
  onOpenDM?: (conversationId: string) => void;
  onAddFriend?: () => void;
  isServerOwner?: boolean;
}

const statusColor: Record<string, string> = {
  online: 'bg-online',
  idle: 'bg-idle',
  dnd: 'bg-dnd',
  offline: 'bg-[#80848E]',
  invisible: 'bg-[#80848E]',
};

export default function UserProfilePopup({ user, onClose, onOpenDM, onAddFriend, isServerOwner }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const setShowUserSettings = useUIStore((s) => s.setShowUserSettings);
  const { friends, setConversations, setCurrentConversation, setFriends } = useDMStore();
  const popupRef = useRef<HTMLDivElement>(null);

  const isSelf = currentUser?._id === user._id;
  const isFriend = friends.some((f) => f._id === user._id);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleMessage = async () => {
    if (isSelf) return;
    try {
      const { conversation } = await dmApi.getOrCreateConversation(user._id);
      const { conversations } = await dmApi.getConversations();
      setConversations(conversations);
      setCurrentConversation(conversation);
      onOpenDM?.(conversation._id);
      onClose();
    } catch {
      toast.error('Failed to open DM');
    }
  };

  const handleAddFriend = async () => {
    if (isSelf || isFriend) return;
    try {
      await friendApi.sendRequestByUsername(user.username);
      toast.success('Friend request sent');
      const data = await friendApi.getFriends();
      setFriends(data.friends, data.incoming, data.outgoing);
      onAddFriend?.();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send request';
      toast.error(msg);
    }
  };

  const handleEditProfile = () => {
    setShowUserSettings(true);
    onClose();
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-layer-1 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-layer-5"
      style={{
        right: MEMBER_LIST_WIDTH + POPUP_GAP,
        top: 72,
        width: POPUP_WIDTH,
        minHeight: 420,
        maxHeight: 'calc(100vh - 88px)',
      }}
    >
      <div className="relative shrink-0">
        <div
          className="w-full"
          style={{ ...getBannerStyle(user.banner), height: BANNER_HEIGHT }}
        />
        <div className="absolute -bottom-10 left-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-layer-4 flex items-center justify-center overflow-hidden ring-4 ring-layer-1">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-bold">
                  {user.displayName?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div
              className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[3px] border-layer-1 ${statusColor[user.status] || 'bg-[#80848E]'}`}
            />
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-14 px-5 pb-5">
        {user.activityStatus && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-layer-3/80 border border-layer-5">
            <p className="text-[#B5BAC1] text-sm truncate">{user.activityStatus}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white font-bold text-xl truncate">{user.displayName}</h3>
          {isServerOwner && (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold bg-idle/20 text-idle">
              Owner
            </span>
          )}
        </div>
        <p className="text-[#80848E] text-sm mb-5">@{user.username}</p>

        <div className="space-y-2">
          {isSelf ? (
            <button
              onClick={handleEditProfile}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-medium text-sm cursor-pointer transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleMessage}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-layer-3 hover:bg-layer-4 text-[#B5BAC1] hover:text-white cursor-pointer transition-colors text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
              {!isFriend && (
                <button
                  onClick={handleAddFriend}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-layer-3 hover:bg-layer-4 text-[#B5BAC1] hover:text-white cursor-pointer transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

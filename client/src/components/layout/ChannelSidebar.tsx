import { useState, useEffect, useRef } from 'react';
import {
  Hash, Volume2, Plus, ChevronDown, ChevronRight, LogOut,
  Settings, X, Trash2, Edit2, UserPlus, DoorOpen, UserCircle, Bell, Mic,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useServerStore } from '../../stores/useServerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { serverApi } from '../../services/api/server.api';
import { userApi } from '../../services/api/user.api';
import { getSocket } from '../../services/socket/socketService';
import { joinVoiceChannel, setInputVolume } from '../../services/voice/webrtcService';
import { toast } from 'sonner';
import ServerSettings from './ServerSettings';
import UserSettings from './UserSettings';
import VoicePanel from '../voice/VoicePanel';
import UserVolumeContextMenu from '../voice/UserVolumeContextMenu';
import type { Channel, Category } from '../../types';

interface ContextMenu {
  x: number;
  y: number;
  type: 'channel' | 'category';
  target: Channel | Category;
}

interface Props {
  onLogout: () => void;
  onClose?: () => void;
  onChannelSelect?: () => void;
  onReopenVoicePanel?: () => void;
}

export default function ChannelSidebar({ onLogout, onClose, onChannelSelect, onReopenVoicePanel }: Props) {
  const user = useAuthStore((s) => s.user);
  const { currentServer, categories, uncategorizedChannels, currentChannel, setCurrentChannel, setChannelData, members, unreadCounts } = useServerStore();
  const { voiceStates, connected: voiceConnected, channelId: voiceChannelId, inputVolume } = useVoiceStore();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const showUserSettings = useUIStore((s) => s.showUserSettings);
  const setShowUserSettings = useUIStore((s) => s.setShowUserSettings);

  // Create channel modal
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | undefined>();
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');

  // Create category
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'channel' | 'category'; id: string; name: string } | null>(null);

  // User volume context menu (for voice participants in sidebar)
  const [userVolumeMenu, setUserVolumeMenu] = useState<{ userId: string; displayName: string; x: number; y: number } | null>(null);

  // Edit channel/category
  const [editTarget, setEditTarget] = useState<{ type: 'channel' | 'category'; id: string; name: string; topic?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');

  // Server header dropdown
  const [showServerMenu, setShowServerMenu] = useState(false);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const [deleteServerConfirm, setDeleteServerConfirm] = useState(false);
  const [deleteServerName, setDeleteServerName] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);

  const isOwner = currentServer?.ownerId === user?._id;

  const statusColor: Record<string, string> = {
    online: 'bg-online',
    idle: 'bg-idle',
    dnd: 'bg-dnd',
    offline: 'bg-[#80848E]',
    invisible: 'bg-[#80848E]',
  };

  // Close context menu & server menu & status menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setShowServerMenu(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(e.target as Node)) {
        setShowVoiceSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!currentServer) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('getVoiceStates', currentServer._id, (states: Record<string, { socketId: string; userId: string; muted: boolean; deafened: boolean }[]>) => {
        useVoiceStore.getState().setAllVoiceStates(states);
      });
    }
  }, [currentServer?._id]);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

const handleSelectChannel = (channel: Channel) => {
    if (channel.type === 'text') {
      setCurrentChannel(channel);
      onChannelSelect?.();
    } else if (channel.type === 'voice') {
    handleJoinVoice(channel);
    }
  };

  const handleJoinVoice = async (channel: Channel) => {
    if (voiceChannelId === channel._id) {
      onReopenVoicePanel?.();
      return;
    }
    try {
      await joinVoiceChannel(channel._id, channel.name, channel.serverId);
    } catch {
      toast.error('Failed to join voice channel. Check microphone permissions.');
    }
  };

  const openCreateChannel = (categoryId?: string) => {
    setCreateChannelCategoryId(categoryId);
    setNewChannelName('');
    setNewChannelType('text');
    setShowCreateChannel(true);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentServer) return;
    try {
      await serverApi.createChannel(currentServer._id, {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: newChannelType,
        categoryId: createChannelCategoryId,
      });
      const { categories: cats, uncategorized } = await serverApi.getChannels(currentServer._id);
      setChannelData(cats, uncategorized);
      setShowCreateChannel(false);
      setNewChannelName('');
      toast.success('Channel created');
    } catch {
      toast.error('Failed to create channel');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !currentServer) return;
    try {
      await serverApi.createCategory(currentServer._id, newCategoryName.trim());
      const { categories: cats, uncategorized } = await serverApi.getChannels(currentServer._id);
      setChannelData(cats, uncategorized);
      setShowCreateCategory(false);
      setNewCategoryName('');
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'channel' | 'category', target: Channel | Category) => {
    if (!isOwner) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, target });
  };

  const refreshChannels = async () => {
    if (!currentServer) return;
    const { categories: cats, uncategorized } = await serverApi.getChannels(currentServer._id);
    setChannelData(cats, uncategorized);
  };

  const handleDeleteChannel = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'channel') return;
    try {
      await serverApi.deleteChannel(deleteConfirm.id);
      if (currentChannel?._id === deleteConfirm.id) setCurrentChannel(null as any);
      await refreshChannels();
      toast.success(`Channel #${deleteConfirm.name} deleted`);
    } catch {
      toast.error('Failed to delete channel');
    }
    setDeleteConfirm(null);
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'category') return;
    try {
      await serverApi.deleteCategory(deleteConfirm.id);
      await refreshChannels();
      toast.success(`Category "${deleteConfirm.name}" deleted`);
    } catch {
      toast.error('Failed to delete category');
    }
    setDeleteConfirm(null);
  };

  const handleEditChannel = async () => {
    if (!editTarget || editTarget.type !== 'channel' || !editName.trim()) return;
    try {
      await serverApi.updateChannel(editTarget.id, {
        name: editName.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: editTopic.trim() || undefined,
      });
      await refreshChannels();
      toast.success('Channel updated');
    } catch {
      toast.error('Failed to update channel');
    }
    setEditTarget(null);
  };

  const handleEditCategory = async () => {
    if (!editTarget || editTarget.type !== 'category' || !editName.trim()) return;
    try {
      await serverApi.updateCategory(editTarget.id, editName.trim());
      await refreshChannels();
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    }
    setEditTarget(null);
  };

  const handleDeleteServer = async () => {
    if (!currentServer || deleteServerName !== currentServer.name) return;
    try {
      await serverApi.deleteServer(currentServer._id);
      useServerStore.getState().removeServer(currentServer._id);
      setDeleteServerConfirm(false);
      setDeleteServerName('');
      toast.success('Server deleted');
    } catch {
      toast.error('Failed to delete server');
    }
  };

  const handleCopyInvite = () => {
    if (!currentServer?.inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${currentServer.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  };

  const getVoiceParticipants = (channelId: string) => {
    const users = voiceStates[channelId] || [];
    return users.map((vu) => {
      const member = members.find((m) => m._id === vu.userId);
      const isSelf = vu.userId === user?._id;
      return {
        ...vu,
        displayName: isSelf && user ? user.displayName : (member?.displayName || 'Unknown'),
        avatar: isSelf && user ? user.avatar : member?.avatar,
      };
    });
  };

  const renderChannel = (channel: Channel) => {
    const isVoice = channel.type === 'voice';
    const voiceParticipants = isVoice ? getVoiceParticipants(channel._id) : [];
    const isInThisVoice = voiceChannelId === channel._id;

    return (
      <div key={channel._id}>
        <div
          onContextMenu={(e) => handleContextMenu(e, 'channel', channel)}
          onClick={() => handleSelectChannel(channel)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer transition-colors group/ch ${
            isVoice
              ? isInThisVoice
                ? 'bg-layer-5/50 text-white'
                : 'text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-4'
              : currentChannel?._id === channel._id
                ? 'bg-layer-5 text-white'
                : 'text-[#80848E] hover:text-[#B5BAC1] hover:bg-layer-4'
          }`}
        >
          {isVoice ? (
            <Volume2 className={`w-4 h-4 shrink-0 ${isInThisVoice ? 'text-online' : 'opacity-70'}`} />
          ) : (
            <Hash className="w-4 h-4 shrink-0 opacity-70" />
          )}
          <span className="truncate flex-1 text-left">{channel.name}</span>

          {!isVoice && (unreadCounts[channel._id] ?? 0) > 0 ? (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-accent-500 text-white text-xs font-bold flex items-center justify-center px-1">
              {(unreadCounts[channel._id] ?? 0) > 99 ? '99+' : unreadCounts[channel._id]}
            </span>
          ) : null}

          {/* Hover action icons (owner only) */}
          {isOwner && (
            <div className="hidden group-hover/ch:flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTarget({ type: 'channel', id: channel._id, name: channel.name, topic: channel.topic });
                  setEditName(channel.name);
                  setEditTopic(channel.topic || '');
                }}
                className="p-0.5 text-[#80848E] hover:text-[#B5BAC1] transition-colors"
                title="Edit Channel"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ type: 'channel', id: channel._id, name: channel.name });
                }}
                className="p-0.5 text-[#80848E] hover:text-danger-400 transition-colors"
                title="Delete Channel"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {isVoice && voiceParticipants.length > 0 && !isOwner && (
            <span className="text-2xs text-[#80848E] tabular-nums">{voiceParticipants.length}</span>
          )}
        </div>

        {isVoice && voiceParticipants.length > 0 && (
          <div className="ml-5 mt-0.5 mb-1 space-y-px">
            {voiceParticipants.map((p) => {
              const isSelf = p.userId === user?._id;
              return (
                <div
                  key={p.userId}
                  className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-layer-4/50 transition-colors cursor-pointer"
                  onContextMenu={
                    !isSelf
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setUserVolumeMenu({ userId: p.userId, displayName: p.displayName, x: e.clientX, y: e.clientY });
                        }
                      : undefined
                  }
                >
                  <div className="relative">
                    <div className={`w-5 h-5 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden shrink-0 ${p.muted ? 'opacity-60' : ''}`}>
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xs font-bold">{p.displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {p.muted && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-danger-500 border border-layer-1 rounded-full flex items-center justify-center">
                        <div className="w-1 h-px bg-white rotate-45" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs truncate ${p.muted ? 'text-[#5C5F66]' : 'text-[#B5BAC1]'}`}>
                    {p.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const bannerValue = currentServer?.banner || '';
  const hasBanner = !!bannerValue;
  const isBannerImage = hasBanner && (bannerValue.startsWith('http://') || bannerValue.startsWith('https://'));

  return (
    <div className="w-60 shrink-0 bg-layer-1 flex flex-col">
      {hasBanner && (
        <div className="w-full h-24 shrink-0 overflow-hidden">
          {isBannerImage ? (
            <img src={bannerValue} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: bannerValue }} />
          )}
        </div>
      )}
      {/* Server header with dropdown */}
      <div ref={serverMenuRef} className="relative">
        <div className="flex items-center h-12 border-b border-layer-3 shadow-sm">
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden shrink-0 p-2 -ml-1 text-[#80848E] hover:text-white hover:bg-layer-4 rounded transition-colors"
              aria-label="Close channel list"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => currentServer && setShowServerMenu((v) => !v)}
            className={`flex-1 min-w-0 h-full px-4 flex items-center justify-between cursor-pointer transition-colors ${
              showServerMenu ? 'bg-layer-3' : 'hover:bg-layer-3/50'
            }`}
          >
            {currentServer ? (
              <>
                <span className="text-white font-semibold text-sm truncate text-left">
                  {currentServer.name}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#80848E] shrink-0 transition-transform ${showServerMenu ? 'rotate-180' : ''}`} />
              </>
            ) : (
              <span className="text-[#80848E] text-sm">Select a server</span>
            )}
          </button>
        </div>

        {/* Server dropdown menu */}
        {showServerMenu && currentServer && (
          <div className="absolute top-full left-2 right-2 mt-1 bg-layer-1 rounded-lg shadow-xl py-1.5 z-50 border border-layer-5">
            <button
              onClick={() => { handleCopyInvite(); setShowServerMenu(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-accent-300 hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite People
            </button>
            <button
              onClick={async () => {
                if (!currentServer) return;
                setShowServerMenu(false);
                try {
                  const { muted, mutedServers } = await userApi.toggleMuteServer(currentServer._id);
                  const u = useAuthStore.getState().user;
                  if (u) useAuthStore.getState().setUser({ ...u, mutedServers });
                  toast.success(muted ? 'Server muted' : 'Server unmuted');
                } catch { toast.error('Failed to update'); }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
            >
              <Bell className="w-4 h-4" />
              {(user?.mutedServers ?? []).includes(currentServer._id) ? 'Unmute Server' : 'Mute Server'}
            </button>
            {isOwner && (
              <button
                onClick={() => { setShowSettings(true); setShowServerMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
              >
                <Settings className="w-4 h-4" />
                Server Settings
              </button>
            )}
            <button
              onClick={() => { openCreateChannel(); setShowServerMenu(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Channel
            </button>
            <button
              onClick={() => { setShowCreateCategory(true); setShowServerMenu(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Category
            </button>

            {!isOwner && (
              <>
                <div className="mx-2 my-1 border-t border-layer-5" />
                <button
                  onClick={async () => {
                    setShowServerMenu(false);
                    try {
                      await serverApi.leaveServer(currentServer._id);
                      useServerStore.getState().removeServer(currentServer._id);
                      toast.success('Left server');
                    } catch { toast.error('Failed to leave server'); }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors"
                >
                  <DoorOpen className="w-4 h-4" />
                  Leave Server
                </button>
              </>
            )}

            {isOwner && (
              <>
                <div className="mx-2 my-1 border-t border-layer-5" />
                <button
                  onClick={() => { setDeleteServerConfirm(true); setShowServerMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Server
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {!currentServer && (
          <p className="text-[#5C5F66] text-xs px-2 py-4">
            No servers yet. Create or join a server to get started.
          </p>
        )}

        {uncategorizedChannels.map(renderChannel)}

        {categories.map((cat) => (
          <div key={cat._id} className="mt-3 first:mt-0">
            {/* Category header */}
            <div
              className="flex items-center group/cat"
              onContextMenu={(e) => handleContextMenu(e, 'category', cat as any)}
            >
              <button
                onClick={() => toggleCategory(cat._id)}
                className="flex items-center gap-0.5 flex-1 min-w-0 py-1 text-[#80848E] hover:text-[#B5BAC1] transition-colors cursor-pointer"
              >
                {collapsedCategories.has(cat._id) ? (
                  <ChevronRight className="w-3 h-3 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 shrink-0" />
                )}
                <span className="text-2xs font-bold uppercase tracking-wider truncate">{cat.name}</span>
              </button>
              {isOwner && (
                <button
                  onClick={() => openCreateChannel(cat._id)}
                  className="opacity-0 group-hover/cat:opacity-100 text-[#80848E] hover:text-[#B5BAC1] cursor-pointer p-0.5 transition-all"
                  title="Create Channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {!collapsedCategories.has(cat._id) && (
              <div className="space-y-0.5">
                {cat.channels.map(renderChannel)}
              </div>
            )}
          </div>
        ))}

        {/* Add category button */}
        {currentServer && isOwner && (
          <div className="mt-4 pt-2 border-t border-layer-4">
            {showCreateCategory ? (
              <div className="px-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-layer-0 text-[#B5BAC1] text-sm px-2 py-1.5 rounded border border-layer-5 focus:outline-none focus:border-accent-500 mb-1"
                  placeholder="Category name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                    if (e.key === 'Escape') setShowCreateCategory(false);
                  }}
                />
                <div className="flex gap-1">
                  <button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer disabled:opacity-50">Create</button>
                  <button onClick={() => setShowCreateCategory(false)} className="text-xs text-[#80848E] hover:text-[#B5BAC1] cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateCategory(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-[#5C5F66] hover:text-[#B5BAC1] text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Category</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Voice panel */}
      {voiceConnected && <VoicePanel />}

      {/* User panel */}
      <div className="h-[52px] bg-layer-0 flex items-center px-2 gap-2 shrink-0 relative" ref={statusMenuRef}>
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-semibold">
                  {user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
                </span>
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
          </div>
        )}
        <div className="relative shrink-0" ref={voiceSettingsRef}>
          <button
            type="button"
            onClick={() => setShowVoiceSettings((v) => !v)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${showVoiceSettings ? 'bg-layer-4 text-white' : 'text-[#80848E] hover:text-white hover:bg-layer-4'}`}
            title="Voice settings"
          >
            <Mic className="w-4 h-4" />
          </button>
          {showVoiceSettings && (
            <div className="absolute bottom-full left-0 mb-1 w-56 p-3 rounded-lg bg-layer-1 border border-layer-5 shadow-xl z-50">
              <p className="text-[#B5BAC1] text-xs font-bold uppercase tracking-wider mb-2">Input Volume</p>
              <p className="text-[#80848E] text-2xs mb-2">How loud you sound to others</p>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={inputVolume}
                onChange={(e) => setInputVolume(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-layer-4 cursor-pointer accent-accent-500"
              />
              <p className="text-[#80848E] text-2xs mt-1">{Math.round(inputVolume * 100)}%</p>
            </div>
          )}
        </div>
        <button onClick={onLogout} className="text-[#80848E] hover:text-danger-400 transition-colors cursor-pointer shrink-0" title="Log out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-layer-1 rounded-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-bold text-lg">Create Channel</h3>
                <button onClick={() => setShowCreateChannel(false)} className="text-[#80848E] hover:text-white cursor-pointer p-1 rounded hover:bg-layer-4 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {createChannelCategoryId && (
                <p className="text-[#80848E] text-xs mb-4">
                  in {categories.find((c) => c._id === createChannelCategoryId)?.name}
                </p>
              )}

              {/* Channel Type */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">Channel Type</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setNewChannelType('text')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                      newChannelType === 'text'
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-layer-5 bg-layer-2 hover:bg-layer-3'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${newChannelType === 'text' ? 'bg-accent-500' : 'bg-layer-4'}`}>
                      <Hash className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">Text</p>
                      <p className="text-[#80848E] text-xs">Send messages, images, GIFs, emoji, opinions, and puns.</p>
                    </div>
                    <div className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      newChannelType === 'text' ? 'border-accent-500' : 'border-[#80848E]'
                    }`}>
                      {newChannelType === 'text' && <div className="w-2.5 h-2.5 rounded-full bg-accent-500" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setNewChannelType('voice')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                      newChannelType === 'voice'
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-layer-5 bg-layer-2 hover:bg-layer-3'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${newChannelType === 'voice' ? 'bg-accent-500' : 'bg-layer-4'}`}>
                      <Volume2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">Voice</p>
                      <p className="text-[#80848E] text-xs">Hang out together with voice, video, and screen share.</p>
                    </div>
                    <div className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      newChannelType === 'voice' ? 'border-accent-500' : 'border-[#80848E]'
                    }`}>
                      {newChannelType === 'voice' && <div className="w-2.5 h-2.5 rounded-full bg-accent-500" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Channel Name */}
              <div className="mb-2">
                <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">Channel Name</label>
                <div className="flex items-center bg-layer-0 border border-layer-5 rounded px-3 py-2 gap-2 focus-within:border-accent-500">
                  {newChannelType === 'text' ? (
                    <Hash className="w-4 h-4 text-[#80848E] shrink-0" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#80848E] shrink-0" />
                  )}
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="flex-1 bg-transparent text-[#B5BAC1] text-sm outline-none placeholder-[#5C5F66]"
                    placeholder="new-channel"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                  />
                </div>
              </div>
            </div>

            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setShowCreateChannel(false)} className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-60 bg-layer-1 rounded-lg shadow-xl py-1.5 min-w-[180px] border border-layer-5"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
        >
          {contextMenu.type === 'channel' && (
            <>
              <button
                onClick={() => {
                  const ch = contextMenu.target as Channel;
                  setEditTarget({ type: 'channel', id: ch._id, name: ch.name, topic: ch.topic });
                  setEditName(ch.name);
                  setEditTopic(ch.topic || '');
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Channel
              </button>
              <button
                onClick={() => {
                  openCreateChannel((contextMenu.target as Channel).categoryId ?? undefined);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Create Channel
              </button>
              <div className="mx-2 my-1 border-t border-layer-5" />
              <button
                onClick={() => {
                  const ch = contextMenu.target as Channel;
                  setDeleteConfirm({ type: 'channel', id: ch._id, name: ch.name });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Channel
              </button>
            </>
          )}
          {contextMenu.type === 'category' && (
            <>
              <button
                onClick={() => {
                  const cat = contextMenu.target as any;
                  setEditTarget({ type: 'category', id: cat._id, name: cat.name });
                  setEditName(cat.name);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Category
              </button>
              <button
                onClick={() => {
                  openCreateChannel((contextMenu.target as any)._id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#B5BAC1] hover:bg-accent-500 hover:text-white cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Channel
              </button>
              <div className="mx-2 my-1 border-t border-layer-5" />
              <button
                onClick={() => {
                  const cat = contextMenu.target as any;
                  setDeleteConfirm({ type: 'category', id: cat._id, name: cat.name });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-500 hover:text-white cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Category
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-layer-1 rounded-xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-white font-bold text-lg mb-2">
                Delete {deleteConfirm.type === 'channel' ? 'Channel' : 'Category'}
              </h3>
              <p className="text-[#B5BAC1] text-sm">
                Are you sure you want to delete{' '}
                <strong className="text-white">
                  {deleteConfirm.type === 'channel' ? `#${deleteConfirm.name}` : deleteConfirm.name}
                </strong>
                ? This cannot be undone.
                {deleteConfirm.type === 'category' && (
                  <span className="block mt-1 text-[#80848E] text-xs">
                    All channels in this category will become uncategorized.
                  </span>
                )}
              </p>
            </div>
            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === 'channel' ? handleDeleteChannel : handleDeleteCategory}
                className="bg-danger-500 hover:bg-danger-400 text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Delete {deleteConfirm.type === 'channel' ? 'Channel' : 'Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Channel/Category Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setEditTarget(null)}>
          <div className="bg-layer-1 rounded-xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">
                  Edit {editTarget.type === 'channel' ? 'Channel' : 'Category'}
                </h3>
                <button onClick={() => setEditTarget(null)} className="text-[#80848E] hover:text-white cursor-pointer p-1 rounded hover:bg-layer-4 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
                {editTarget.type === 'channel' ? 'Channel' : 'Category'} Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-layer-0 text-[#B5BAC1] text-sm px-3 py-2 rounded border border-layer-5 focus:outline-none focus:border-accent-500 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editTarget.type === 'channel') handleEditChannel();
                    else handleEditCategory();
                  }
                  if (e.key === 'Escape') setEditTarget(null);
                }}
              />
              {editTarget.type === 'channel' && (
                <>
                  <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
                    Channel Topic
                  </label>
                  <textarea
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    placeholder="What is this channel about?"
                    rows={3}
                    maxLength={1024}
                    className="w-full bg-layer-0 text-[#B5BAC1] text-sm px-3 py-2 rounded border border-layer-5 focus:outline-none focus:border-accent-500 resize-none"
                  />
                </>
              )}
            </div>
            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setEditTarget(null)}
                className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editTarget.type === 'channel') handleEditChannel();
                  else handleEditCategory();
                }}
                disabled={
                  editTarget.type === 'category'
                    ? !editName.trim() || editName.trim() === editTarget.name
                    : !editName.trim() ||
                      (editName.trim() === editTarget.name && editTopic.trim() === (editTarget.topic || ''))
                }
                className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Server Confirmation Modal */}
      {deleteServerConfirm && currentServer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setDeleteServerConfirm(false); setDeleteServerName(''); }}>
          <div className="bg-layer-1 rounded-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-white font-bold text-xl mb-2">Delete '{currentServer.name}'</h3>
              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3 mb-4">
                <p className="text-warning-400 text-sm font-medium mb-1">Are you sure you want to delete this server?</p>
                <p className="text-[#80848E] text-xs">This action cannot be undone. This will permanently delete the server, all channels, messages, and remove all members.</p>
              </div>
              <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-2">
                Enter server name to confirm
              </label>
              <input
                type="text"
                value={deleteServerName}
                onChange={(e) => setDeleteServerName(e.target.value)}
                className="w-full bg-layer-0 text-[#B5BAC1] text-sm px-3 py-2 rounded border border-layer-5 focus:outline-none focus:border-danger-500"
                placeholder={currentServer.name}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteServerName === currentServer.name) handleDeleteServer();
                  if (e.key === 'Escape') { setDeleteServerConfirm(false); setDeleteServerName(''); }
                }}
              />
            </div>
            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteServerConfirm(false); setDeleteServerName(''); }}
                className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteServer}
                disabled={deleteServerName !== currentServer.name}
                className="bg-danger-500 hover:bg-danger-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Delete Server
              </button>
            </div>
          </div>
        </div>
      )}

      {userVolumeMenu && (
        <UserVolumeContextMenu
          userId={userVolumeMenu.userId}
          displayName={userVolumeMenu.displayName}
          x={userVolumeMenu.x}
          y={userVolumeMenu.y}
          onClose={() => setUserVolumeMenu(null)}
        />
      )}

      {showSettings && <ServerSettings onClose={() => setShowSettings(false)} />}
      {showUserSettings && <UserSettings onClose={() => setShowUserSettings(false)} />}
    </div>
  );
}

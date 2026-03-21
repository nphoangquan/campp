import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useServerStore } from '../../stores/useServerStore';
import { useMessageStore } from '../../stores/useMessageStore';
import { useDMStore } from '../../stores/useDMStore';
import { useVoiceStore, type VoiceUser } from '../../stores/useVoiceStore';
import { leaveVoiceChannel } from '../../services/voice/webrtcService';
import { serverApi } from '../../services/api/server.api';
import { messageApi } from '../../services/api/message.api';
import { dmApi } from '../../services/api/dm.api';
import { friendApi } from '../../services/api/friend.api';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket, getSocket } from '../../services/socket/socketService';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNotifications } from '../../hooks/useNotifications';
import ServerList from './ServerList';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import MemberList from './MemberList';
import DMSidebar from '../dm/DMSidebar';
import DMChat from '../dm/DMChat';
import FriendsPage from '../dm/FriendsPage';
import InboxButton from '../ui/InboxButton';
import VoiceCallView from '@/components/voice/VoiceCallView';
import type { Message, DirectMessage } from '../../types';

type AppView = 'server' | 'dm';
type DMSubView = 'friends' | 'conversation';

export default function AppLayout() {
  const { serverId: urlServerId, channelId: urlChannelId, conversationId: urlConversationId } = useParams<{ serverId?: string; channelId?: string; conversationId?: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isDMView = pathname.startsWith('/channels/@me');
  const effectiveServerId = isDMView ? '@me' : urlServerId;
  const effectiveChannelId = isDMView ? urlConversationId : urlChannelId;

  const { accessToken, logout: authLogout } = useAuthStore();
  const { servers, currentServer, currentChannel, setServers, setChannelData, setMembers, setCurrentServer, setCurrentChannel, addServer, setUnreadCounts, clearUnread } = useServerStore();
  const { setMessages, setCurrentChannelId, setHasMore, setLoading, clear: clearMessages, hasCachedMessages } = useMessageStore();
  const { setCurrentConversation, conversations } = useDMStore();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTabletOrLarger = useMediaQuery('(min-width: 768px)');
  const { showNotification, requestPermission } = useNotifications();

  const [appView, setAppView] = useState<AppView>('server');
  const [dmSubView, setDMSubView] = useState<DMSubView>('friends');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [urlRestored, setUrlRestored] = useState(false);
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false);
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [dmSidebarOpen, setDmSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  type VoicePanelMode = 'center' | 'dock' | 'bubble';
  const [voicePanelMode, setVoicePanelMode] = useState<VoicePanelMode>('bubble');

  const voiceConnected = useVoiceStore((s) => s.connected);
  const voiceChannelName = useVoiceStore((s) => s.channelName);

  const prevVoiceConnectedRef = useRef<boolean>(false);
  useEffect(() => {
    // When user joins a voice call, open in center (largest) first.
    // After that, user can dock/bubble manually.
    const prev = prevVoiceConnectedRef.current;
    if (!prev && voiceConnected) {
      setVoicePanelMode('center');
    }
    prevVoiceConnectedRef.current = voiceConnected;
  }, [voiceConnected]);

  // Auto-dock ONLY when user switches channels while in center mode.
  // This avoids immediately docking again when user manually expands on a text channel.
  const prevChannelIdRef = useRef<string | null>(null);
  const prevVoicePanelModeRef = useRef<VoicePanelMode>('bubble');
  useEffect(() => {
    const prevChannelId = prevChannelIdRef.current;
    const prevMode = prevVoicePanelModeRef.current;
    const nextChannelId = currentChannel?._id ?? null;

    const channelChanged = prevChannelId !== null && nextChannelId !== prevChannelId;
    if (voiceConnected && channelChanged && prevMode === 'center' && currentChannel?.type === 'text') {
      setVoicePanelMode('dock');
    }

    prevChannelIdRef.current = nextChannelId;
    prevVoicePanelModeRef.current = voicePanelMode;
  }, [voiceConnected, voicePanelMode, currentChannel?._id, currentChannel?.type]);

  useEffect(() => {
    serverApi.getMyServers()
      .then(({ servers }) => setServers(servers))
      .catch(console.error);
  }, [setServers]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const timer = setTimeout(() => {
      toast('Enable notifications to get alerts when you are away', {
        action: {
          label: 'Enable',
          onClick: async () => {
            const ok = await requestPermission();
            if (ok) toast.success('Notifications enabled');
            else toast.error('Could not enable notifications');
          },
        },
        duration: 10000,
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [requestPermission]);

  // Keep socket + voice connection stable across navigation inside the app.
  // Only disconnect when auth token changes (logout) or component unmounts.
  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket();

    socket.on('messageReceived', (message: Message) => {
      const serverStore = useServerStore.getState();
      const authStore = useAuthStore.getState();
      if (message.channelId === serverStore.currentChannel?._id) {
        const msgStore = useMessageStore.getState();
        const messages = msgStore.getMessagesForChannel(serverStore.currentChannel?._id);
        const isOwnMessage = message.authorId._id === authStore.user?._id;
        const tempMsg = messages.find((m) => m._id.startsWith('temp-'));
        if (isOwnMessage && tempMsg) {
          useMessageStore.getState().replaceOptimisticMessage(tempMsg._id, message);
        } else {
          useMessageStore.getState().addMessage(message);
        }
      } else if (message.channelId && serverStore.currentServer) {
        serverStore.incrementUnread(message.channelId);
        const meId = authStore.user?._id;
        const isMentioned = (message.mentions ?? []).some((id) => id === meId || (typeof id === 'object' && (id as { _id?: string })?._id === meId));
        if (message.authorId._id !== meId && isMentioned && document.visibilityState === 'hidden') {
          const author = (message.authorId as { displayName?: string }).displayName || 'Someone';
          const allChannels = [...serverStore.uncategorizedChannels, ...serverStore.categories.flatMap((c) => c.channels || [])];
          const ch = allChannels.find((c) => c._id === message.channelId);
          const channelName = ch?.name ?? 'channel';
          const body = message.content ? (message.content.length > 80 ? `${message.content.slice(0, 77)}...` : message.content) : 'Sent an attachment';
          showNotification(`${author} mentioned you in #${channelName}`, { body });
        }
      }
    });

    socket.on('messageUpdated', (message: Message) => {
      useMessageStore.getState().updateMessage(message);
    });

    socket.on('messageDeleted', ({ messageId }: { messageId: string }) => {
      useMessageStore.getState().removeMessage(messageId);
    });

    socket.on('userStatusChanged', ({ userId, status }: { userId: string; status: string }) => {
      useServerStore.getState().updateMemberStatus(userId, status);
      useDMStore.getState().updateParticipantStatus(userId, status);
      if (userId === useAuthStore.getState().user?._id) {
        useAuthStore.getState().setUserStatus(status as import('../../types').UserStatus);
      }
    });

    socket.on('initialStatus', ({ status }: { status: string }) => {
      useAuthStore.getState().setUserStatus(status as import('../../types').UserStatus);
    });

    socket.on('dmReceived', (message: DirectMessage) => {
      const dmStore = useDMStore.getState();
      if (message.conversationId === dmStore.currentConversation?._id) {
        dmStore.addMessage(message);
      }
      dmStore.updateConversationLastMessage(message.conversationId, message);
    });

    socket.on('voiceStateUpdate', (data: { channelId: string; users: VoiceUser[] }) => {
      useVoiceStore.getState().updateVoiceState(data.channelId, data.users);
    });

    socket.on('reactionUpdated', (data: { messageId: string; reactions: { emoji: string; users: string[] }[] }) => {
      useMessageStore.getState().updateReactions(data.messageId, data.reactions);
    });

    socket.on('friendListUpdate', (payload?: { type?: string; acceptedBy?: string }) => {
      friendApi.getFriends()
        .then((data) => useDMStore.getState().setFriends(data.friends, data.incoming, data.outgoing))
        .catch(() => { });
      dmApi.getConversations()
        .then(({ conversations: c }) => useDMStore.getState().setConversations(c))
        .catch(() => { });
      if (payload?.type === 'accepted' && payload?.acceptedBy) {
        toast.success(`${payload.acceptedBy} accepted your friend request`);
      }
    });

    return () => {
      leaveVoiceChannel();
      disconnectSocket();
    };
  }, [accessToken, showNotification]);

  useEffect(() => {
    const serverId = currentServer?._id;
    if (!serverId) {
      setChannelData([], []);
      setMembers([]);
      return;
    }

    serverApi.getChannels(serverId)
      .then(({ categories, uncategorized }) => setChannelData(categories, uncategorized))
      .catch(console.error);

    serverApi.getUnreadCounts(serverId)
      .then(({ unreadCounts }) => setUnreadCounts(unreadCounts))
      .catch(console.error);

    serverApi.getMembers(serverId, { limit: 200 })
      .then(({ members }) => setMembers(members))
      .catch(console.error);
  }, [currentServer?._id, setChannelData, setMembers, setUnreadCounts]);

  // Restore state from URL on load / refresh
  useEffect(() => {
    if (!effectiveServerId) {
      setAppView('server');
      setCurrentServer(null);
      setCurrentChannel(null);
      setCurrentConversationId(null);
      setDMSubView('friends');
      setUrlRestored(true);
      return;
    }
    if (effectiveServerId === '@me') {
      setAppView('dm');
      setCurrentServer(null);
      setCurrentChannel(null);
      setCurrentConversationId(effectiveChannelId || null);
      setDMSubView(effectiveChannelId ? 'conversation' : 'friends');
      if (effectiveChannelId) {
        setCurrentConversationId(effectiveChannelId);
        const convs = useDMStore.getState().conversations;
        const conv = convs.find((c) => c._id === effectiveChannelId);
        if (conv) useDMStore.getState().setCurrentConversation(conv);
        else {
          dmApi.getConversations().then(({ conversations: c }) => {
            useDMStore.getState().setConversations(c);
            const found = c.find((x) => x._id === effectiveChannelId);
            if (found) useDMStore.getState().setCurrentConversation(found);
          }).catch(() => navigate('/channels'));
        }
      }
      setUrlRestored(true);
      return;
    }
    serverApi.getServer(effectiveServerId)
      .then(({ server }) => {
        addServer(server);
        setCurrentServer(server);
        setAppView('server');
        setCurrentConversationId(null);
        if (!effectiveChannelId) {
          setCurrentChannel(null);
          setUrlRestored(true);
          return;
        }
        serverApi.getChannels(server._id).then(({ categories: cats, uncategorized }) => {
          setChannelData(cats, uncategorized);
          const allChannels = [...uncategorized, ...cats.flatMap((c) => c.channels || [])];
          const ch = allChannels.find((c) => c._id === effectiveChannelId);
          if (ch && ch.type === 'text') {
            setCurrentChannel(ch);
          } else if (!ch) {
            navigate(`/channels/${effectiveServerId}`);
          }
          setUrlRestored(true);
        }).catch(() => navigate('/channels'));
      })
      .catch(() => navigate('/channels'));
  }, [effectiveServerId, effectiveChannelId, setCurrentServer, setCurrentChannel, setChannelData, addServer, navigate]);

  // Sync state to URL when user selects server/channel
  useEffect(() => {
    if (!urlRestored) return;
    let target: string;
    if (appView === 'dm') {
      target = currentConversationId ? `/channels/@me/${currentConversationId}` : '/channels/@me';
    } else if (!currentServer) {
      target = '/channels';
    } else if (currentChannel?.type === 'text') {
      target = `/channels/${currentServer._id}/${currentChannel._id}`;
    } else {
      target = `/channels/${currentServer._id}`;
    }
    if (window.location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [urlRestored, appView, currentServer, currentChannel, currentConversationId, navigate]);

  const loadMessages = useCallback(async (channelId: string) => {
    setCurrentChannelId(channelId);

    if (hasCachedMessages(channelId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { messages } = await messageApi.getMessages(channelId);
      setMessages(channelId, messages, messages.length >= 50);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [setMessages, setHasMore, setLoading, setCurrentChannelId, hasCachedMessages]);

  useEffect(() => {
    if (!currentChannel) {
      setCurrentChannelId(null);
      return;
    }

    const channelId = currentChannel._id;
    const socket = getSocket();
    if (socket) {
      socket.emit('joinChannel', channelId);
    }

    loadMessages(channelId);

    if (currentChannel.type === 'text') {
      serverApi.markChannelRead(channelId).catch(console.error);
      clearUnread(channelId);
    }

    return () => {
      if (socket) {
        socket.emit('leaveChannel', channelId);
      }
    };
  }, [currentChannel?._id, loadMessages, clearUnread, setCurrentChannelId]);

  const handleSelectServer = async (serverId: string) => {
    if (!serverId) {
      setAppView('dm');
      setCurrentServer(null);
      setCurrentChannel(null);
      setCurrentConversationId(null);
      setDMSubView('friends');
      clearMessages();
      navigate('/channels/@me');
      return;
    }

    setAppView('server');
    setCurrentChannel(null);
    setCurrentConversationId(null);
    clearMessages();

    // Optimistic: show new server and URL immediately so sync effect doesn't revert to old server
    const cached = servers.find((s) => s._id === serverId);
    if (cached) {
      setCurrentServer(cached);
    }
    navigate(`/channels/${serverId}`);

    try {
      const { server } = await serverApi.getServer(serverId);
      addServer(server);
      setCurrentServer(server);
      if (window.location.pathname !== `/channels/${serverId}`) {
        navigate(`/channels/${serverId}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to load server:', error);
      setCurrentServer(null);
      navigate('/channels');
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setDMSubView('conversation');
    navigate(`/channels/@me/${conversationId}`);
    const conv = conversations.find((c) => c._id === conversationId);
    if (conv) {
      setCurrentConversation(conv);
    } else {
      try {
        const { conversations: convs } = await dmApi.getConversations();
        useDMStore.getState().setConversations(convs);
        const found = convs.find((c) => c._id === conversationId);
        if (found) setCurrentConversation(found);
      } catch { /* ignore */ }
    }
  };

  const handleSelectFriends = () => {
    setDMSubView('friends');
    setCurrentConversationId(null);
    setCurrentConversation(null);
    navigate('/channels/@me');
  };

  const handleLogout = async () => {
    disconnectSocket();
    try {
      const { authApi } = await import('../../services/api/auth.api');
      await authApi.logout();
    } catch { /* ignore */ }
    authLogout();
  };

  const requestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleSelectConv = (id: string) => {
    handleSelectConversation(id);
    if (!isTabletOrLarger) setDmSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-layer-2 overflow-hidden" role="application" aria-label="Camp chat application">
      <ServerList onSelectServer={handleSelectServer} isHome={appView === 'dm'} />

      {appView === 'server' ? (
        isDesktop ? (
          <>
            {/* Desktop: original 3-column layout */}
            <ChannelSidebar
              onLogout={requestLogout}
              onReopenVoicePanel={() => setVoicePanelMode('center')}
            />
            <>
              {/* Center (wide) voice view like original (figure 1) */}
              {voiceConnected && voicePanelMode === 'center' ? (
                <div className="flex-1 flex min-w-0">
                  <VoiceCallView onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)} />
                  <button
                    type="button"
                    onClick={() => setVoicePanelMode('dock')}
                    className="fixed bottom-4 right-4 z-50 bg-layer-3 border border-white/10 text-white px-3 py-2 rounded-full shadow-xl hover:bg-layer-4 cursor-pointer flex items-center gap-2"
                    title="Minimize"
                  >
                    <span className="w-2 h-2 rounded-full bg-online" />
                    <span className="text-sm font-medium">Minimize</span>
                  </button>
                </div>
              ) : (
                <>
                  <ChatArea onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)} />
                  {currentServer && <MemberList onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)} />}
                </>
              )}

              {/* Voice call dock: keep call running while navigating text channels/servers */}
              {voiceConnected && voicePanelMode !== 'center' && (
                <div className="fixed bottom-4 right-4 z-50">
                  {/* Bubble (small) */}
                  {voicePanelMode === 'bubble' && (
                    <button
                      type="button"
                      onClick={() => setVoicePanelMode('center')}
                      className="bg-layer-3 border border-white/10 text-white px-3 py-2 rounded-full shadow-xl hover:bg-layer-4 cursor-pointer flex items-center gap-2"
                      title="Open voice"
                    >
                      <span className="w-2 h-2 rounded-full bg-online" />
                      <span className="text-sm font-medium truncate max-w-[220px]">{voiceChannelName || 'Voice Channel'}</span>
                    </button>
                  )}

                  {/* Dock (corner) */}
                  {voicePanelMode === 'dock' && (
                    <div className="w-[420px] h-[520px] bg-layer-2 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                      <div className="h-10 px-3 flex items-center justify-between bg-layer-3 border-b border-white/10">
                        <div className="text-[#B5BAC1] text-sm truncate">
                          Voice: <span className="text-white font-medium">{voiceChannelName || 'Voice Channel'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVoicePanelMode('center')}
                            className="text-[#80848E] hover:text-white text-sm px-2 py-1 rounded hover:bg-layer-4 cursor-pointer"
                            title="Expand"
                          >
                            Expand
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoicePanelMode('bubble')}
                            className="text-[#80848E] hover:text-white text-sm px-2 py-1 rounded hover:bg-layer-4 cursor-pointer"
                            title="Minimize"
                          >
                            Minimize
                          </button>
                        </div>
                      </div>
                      <div className="h-[calc(520px-40px)]">
                        <VoiceCallView onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          </>
        ) : (
          <>
            {/* Mobile/Tablet: overlay sidebars */}
            <div
              className={`fixed inset-0 z-40 transition-opacity duration-200 ${channelSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setChannelSidebarOpen(false)}
                aria-hidden="true"
              />
              <div
                className={`absolute left-[72px] top-0 bottom-0 w-60 bg-layer-1 flex flex-col z-50 shadow-xl transition-transform duration-200 ${channelSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                  }`}
                role="navigation"
                aria-label="Channel list"
              >
                <ChannelSidebar
                  onLogout={requestLogout}
                  onClose={() => setChannelSidebarOpen(false)}
                  onChannelSelect={() => setChannelSidebarOpen(false)}
                  onReopenVoicePanel={() => setVoicePanelMode('center')}
                />
              </div>
            </div>

            <ChatArea
              onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)}
              onOpenChannelSidebar={() => setChannelSidebarOpen(true)}
              onOpenMemberList={() => setMemberListOpen(true)}
              showChannelMenu
              showMemberMenu={!!currentServer}
            />

            {currentServer && (
              <div
                className={`fixed inset-0 z-40 transition-opacity duration-200 ${memberListOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div
                  className="absolute inset-0 bg-black/60"
                  onClick={() => setMemberListOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className={`absolute right-0 top-0 bottom-0 w-60 bg-layer-1 z-50 shadow-xl transition-transform duration-200 ${memberListOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  role="complementary"
                  aria-label="Member list"
                >
                  <MemberList
                    onOpenDM={(id: string) => navigate(`/channels/@me/${id}`)}
                    onClose={() => setMemberListOpen(false)}
                    showCloseButton
                  />
                </div>
              </div>
            )}
          </>
        )
      ) : isTabletOrLarger ? (
        <>
          {/* Desktop/Tablet: original DM layout */}
          <DMSidebar
            view={dmSubView}
            currentConversationId={currentConversationId}
            onSelectFriends={handleSelectFriends}
            onSelectConversation={handleSelectConversation}
            onLogout={requestLogout}
          />
          {dmSubView === 'friends' ? (
            <FriendsPage onOpenDM={handleSelectConversation} />
          ) : currentConversationId ? (
            <DMChat conversationId={currentConversationId} />
          ) : (
            <div className="flex-1 flex flex-col bg-layer-2">
              <div className="h-12 px-4 flex items-center gap-3 border-b border-layer-4 shrink-0">
                <span className="text-white font-semibold text-sm">Direct Messages</span>
                <div className="ml-auto">
                  <InboxButton />
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center text-[#80848E]">
                Select a conversation
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Mobile: DM sidebar overlay + menu button in chat */}
          <div
            className={`fixed inset-0 z-40 transition-opacity duration-200 ${dmSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setDmSidebarOpen(false)}
              aria-hidden="true"
            />
            <div
              className={`absolute left-[72px] top-0 bottom-0 w-60 bg-layer-1 flex flex-col z-50 shadow-xl transition-transform duration-200 ${dmSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              role="navigation"
              aria-label="Direct messages"
            >
              <DMSidebar
                view={dmSubView}
                currentConversationId={currentConversationId}
                onSelectFriends={handleSelectFriends}
                onSelectConversation={handleSelectConv}
                onLogout={requestLogout}
                onClose={() => setDmSidebarOpen(false)}
              />
            </div>
          </div>

          {dmSubView === 'friends' ? (
            <FriendsPage onOpenDM={handleSelectConv} />
          ) : currentConversationId ? (
            <DMChat
              conversationId={currentConversationId}
              onOpenDMSidebar={() => setDmSidebarOpen(true)}
              showMenuButton
            />
          ) : (
            <div className="flex-1 flex flex-col bg-layer-2">
              <div className="h-12 px-4 flex items-center gap-3 border-b border-layer-4 shrink-0">
                <span className="text-white font-semibold text-sm">Direct Messages</span>
                <div className="ml-auto">
                  <InboxButton />
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center text-[#80848E]">
                Select a conversation
              </div>
            </div>
          )}
        </>
      )}

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-layer-1 rounded-xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-white font-bold text-lg mb-2">Log Out</h3>
              <p className="text-[#B5BAC1] text-sm">
                Are you sure you want to log out from Camp on this device?
              </p>
            </div>
            <div className="bg-layer-0 px-6 py-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="text-sm text-[#B5BAC1] hover:text-white hover:underline cursor-pointer px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  await handleLogout();
                }}
                className="bg-danger-500 hover:bg-danger-400 text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

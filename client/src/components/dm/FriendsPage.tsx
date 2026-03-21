import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, Check, X, UserMinus, MessageSquare, Search } from 'lucide-react';
import InboxButton from '../ui/InboxButton';
import { useDMStore } from '../../stores/useDMStore';
import { friendApi } from '../../services/api/friend.api';
import { dmApi } from '../../services/api/dm.api';
import { toast } from 'sonner';
import type { User } from '../../types';

type Tab = 'online' | 'all' | 'pending' | 'add';

const DEBOUNCE_MS = 400;

interface Props {
  onOpenDM: (conversationId: string) => void;
}

export default function FriendsPage({ onOpenDM }: Props) {
  const { friends, incoming, outgoing, setFriends } = useDMStore();
  const [tab, setTab] = useState<Tab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [addUsername, setAddUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [sendingUsername, setSendingUsername] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const data = await friendApi.getFriends();
      setFriends(data.friends, data.incoming, data.outgoing);
    } catch {
      toast.error('Failed to load friends');
    }
  }, [setFriends]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Debounced search when typing in Add Friend tab
  useEffect(() => {
    if (tab !== 'add') return;
    const q = addUsername.trim();
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      setSearching(true);
      try {
        const { users } = await friendApi.searchUsers(q);
        setSearchResults(users);
      } catch {
        toast.error('Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tab, addUsername]);

  const handleSendByUsername = async () => {
    const q = addUsername.trim();
    if (!q || sendingUsername) return;
    setSendingUsername(true);
    try {
      await friendApi.sendRequestByUsername(q);
      toast.success('Friend request sent');
      loadFriends();
      setAddUsername('');
      setSearchResults([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send request';
      toast.error(msg);
    } finally {
      setSendingUsername(false);
    }
  };

  const handleSendRequest = async (targetId: string) => {
    try {
      await friendApi.sendRequest(targetId);
      toast.success('Friend request sent');
      loadFriends();
      setSearchResults((prev) => prev.filter((u) => u._id !== targetId));
    } catch {
      toast.error('Failed to send request');
    }
  };

  const handleAccept = async (targetId: string) => {
    try {
      await friendApi.acceptRequest(targetId);
      toast.success('Friend request accepted');
      loadFriends();
    } catch {
      toast.error('Failed to accept');
    }
  };

  const handleDecline = async (targetId: string) => {
    try {
      await friendApi.declineRequest(targetId);
      loadFriends();
    } catch {
      toast.error('Failed to decline');
    }
  };

  const handleCancel = async (targetId: string) => {
    try {
      await friendApi.cancelRequest(targetId);
      loadFriends();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const handleRemove = async (targetId: string) => {
    try {
      await friendApi.removeFriend(targetId);
      toast.success('Friend removed');
      loadFriends();
    } catch {
      toast.error('Failed to remove friend');
    }
  };

  const handleOpenDM = async (targetId: string) => {
    try {
      const { conversation } = await dmApi.getOrCreateConversation(targetId);
      onOpenDM(conversation._id);
    } catch {
      toast.error('Failed to open DM');
    }
  };

  const onlineFriends = friends.filter((f) => f.status !== 'offline');
  const filteredFriends = tab === 'online' ? onlineFriends : friends;
  const displayFriends = searchQuery
    ? filteredFriends.filter((f) =>
        f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredFriends;

  const statusColor: Record<string, string> = {
    online: 'bg-online', idle: 'bg-idle', dnd: 'bg-dnd', offline: 'bg-[#80848E]', invisible: 'bg-[#80848E]',
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'online', label: 'Online', count: onlineFriends.length },
    { key: 'all', label: 'All', count: friends.length },
    { key: 'pending', label: 'Pending', count: incoming.length + outgoing.length },
    { key: 'add', label: 'Add Friend' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-layer-2 overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-4 border-b border-layer-4 shrink-0">
        <div className="flex items-center gap-2 text-white font-semibold flex-1 min-w-0">
          <UserPlus className="w-5 h-5 text-[#80848E] shrink-0" />
          Friends
        </div>
        <div className="w-px h-6 bg-layer-5 shrink-0" />
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded text-sm font-medium cursor-pointer transition-colors ${
              tab === t.key
                ? t.key === 'add' ? 'bg-online text-white' : 'bg-layer-4 text-white'
                : 'text-[#B5BAC1] hover:text-white hover:bg-layer-3'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 bg-layer-5 text-[#B5BAC1] text-2xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <InboxButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add Friend tab */}
        {tab === 'add' && (
          <div className="p-6">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Add Friend</h3>
            <p className="text-[#80848E] text-sm mb-4">You can add friends with their username. Search as you type or send a request directly.</p>

            <div className="flex gap-2 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="input text-sm pr-10"
                  placeholder="Enter a username..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendByUsername();
                  }}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
              </div>
              <button
                onClick={handleSendByUsername}
                disabled={!addUsername.trim() || sendingUsername}
                className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded cursor-pointer transition-colors"
              >
                {sendingUsername ? 'Sending...' : 'Send Friend Request'}
              </button>
            </div>

            {searching && addUsername.trim() && (
              <p className="text-[#80848E] text-xs mb-2">Searching...</p>
            )}

            {!searching && addUsername.trim() && searchResults.length === 0 && (
              <p className="text-[#80848E] text-sm">No users found. Try a different username.</p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-1">
                <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider mb-2">Search results</p>
                {searchResults.map((u) => {
                  const isFriend = friends.some((f) => f._id === u._id);
                  const isPending = outgoing.some((f) => f._id === u._id);
                  return (
                    <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-layer-3 transition-colors">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-sm font-bold">{u.displayName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor[u.status]} border-[2.5px] border-layer-2 rounded-full`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{u.displayName}</span>
                        <span className="text-[#80848E] text-xs ml-1.5">@{u.username}</span>
                      </div>
                      {isFriend ? (
                        <span className="text-online text-xs font-medium">Already friends</span>
                      ) : isPending ? (
                        <span className="text-[#80848E] text-xs font-medium">Request sent</span>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(u._id)}
                          className="bg-accent-500 hover:bg-accent-400 text-white text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-colors"
                        >
                          Send Request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pending tab */}
        {tab === 'pending' && (
          <div className="p-4">
            {incoming.length > 0 && (
              <>
                <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-2 mb-2">
                  Incoming &mdash; {incoming.length}
                </p>
                <div className="space-y-0.5 mb-4">
                  {incoming.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-layer-3 transition-colors group">
                      <div className="w-9 h-9 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-sm font-bold">{u.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{u.displayName}</span>
                        <p className="text-[#80848E] text-xs">Incoming Friend Request</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(u._id)}
                          className="w-9 h-9 rounded-full bg-layer-4 hover:bg-online flex items-center justify-center cursor-pointer transition-colors"
                          title="Accept"
                        >
                          <Check className="w-4 h-4 text-[#B5BAC1]" />
                        </button>
                        <button
                          onClick={() => handleDecline(u._id)}
                          className="w-9 h-9 rounded-full bg-layer-4 hover:bg-danger-500 flex items-center justify-center cursor-pointer transition-colors"
                          title="Decline"
                        >
                          <X className="w-4 h-4 text-[#B5BAC1]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {outgoing.length > 0 && (
              <>
                <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-2 mb-2">
                  Outgoing &mdash; {outgoing.length}
                </p>
                <div className="space-y-0.5">
                  {outgoing.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-layer-3 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-sm font-bold">{u.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{u.displayName}</span>
                        <p className="text-[#80848E] text-xs">Outgoing Friend Request</p>
                      </div>
                      <button
                        onClick={() => handleCancel(u._id)}
                        className="w-9 h-9 rounded-full bg-layer-4 hover:bg-danger-500 flex items-center justify-center cursor-pointer transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4 text-[#B5BAC1]" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="text-center py-16">
                <p className="text-[#80848E] text-sm">No pending friend requests</p>
              </div>
            )}
          </div>
        )}

        {/* Online / All tabs */}
        {(tab === 'online' || tab === 'all') && (
          <div className="p-4">
            <div className="px-2 mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input text-sm pl-9"
                  placeholder="Search friends"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E]" />
              </div>
            </div>

            <p className="text-[#80848E] text-2xs font-bold uppercase tracking-wider px-2 mb-2">
              {tab === 'online' ? 'Online' : 'All Friends'} &mdash; {displayFriends.length}
            </p>

            <div className="space-y-0.5">
              {displayFriends.map((friend) => (
                <div key={friend._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-layer-3 transition-colors group">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-accent-600 flex items-center justify-center overflow-hidden">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">{friend.displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor[friend.status]} border-[2.5px] border-layer-2 rounded-full`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm font-medium">{friend.displayName}</span>
                    <p className="text-[#80848E] text-xs capitalize">{friend.status}</p>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenDM(friend._id)}
                      className="w-9 h-9 rounded-full bg-layer-4 hover:bg-layer-5 flex items-center justify-center cursor-pointer transition-colors"
                      title="Message"
                    >
                      <MessageSquare className="w-4 h-4 text-[#B5BAC1]" />
                    </button>
                    <button
                      onClick={() => handleRemove(friend._id)}
                      className="w-9 h-9 rounded-full bg-layer-4 hover:bg-danger-500 flex items-center justify-center cursor-pointer transition-colors"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-4 h-4 text-[#B5BAC1]" />
                    </button>
                  </div>
                </div>
              ))}

              {displayFriends.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-[#80848E] text-sm">
                    {tab === 'online' ? 'No friends are online right now.' : 'No friends yet. Add some!'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

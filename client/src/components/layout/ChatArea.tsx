import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Hash, X, Reply, Smile, Pin, Paperclip, Search, FileText, Menu, Users, Eye, EyeOff, Trash2 } from 'lucide-react';
import InboxButton from '../ui/InboxButton';
import MentionAutocomplete from '../ui/MentionAutocomplete';
import { useServerStore } from '../../stores/useServerStore';
import { useMessageStore } from '../../stores/useMessageStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { messageApi } from '../../services/api/message.api';
import { roleApi } from '../../services/api/moderation.api';
import { getSocket } from '../../services/socket/socketService';
import { toast } from 'sonner';
import type { Message, User, Role } from '../../types';

const EMPTY_MESSAGES: Message[] = [];
import EmojiPicker, { Theme } from 'emoji-picker-react';
import MarkdownContent from '../ui/MarkdownContent';
import UserProfilePopup from '../ui/UserProfilePopup';
import MessageSkeleton from '../ui/MessageSkeleton';
import LinkPreview from '../ui/LinkPreview';
import { extractUrls } from '../../utils/extractUrls';

const TYPING_TIMEOUT_MS = 5000;

interface Props {
  onOpenDM?: (conversationId: string) => void;
  onOpenChannelSidebar?: () => void;
  onOpenMemberList?: () => void;
  showChannelMenu?: boolean;
  showMemberMenu?: boolean;
}

export default function ChatArea({ onOpenDM, onOpenChannelSidebar, onOpenMemberList, showChannelMenu, showMemberMenu }: Props) {
  const { currentServer, currentChannel, members } = useServerStore();
  const currentChannelId = currentChannel?._id ?? null;
  const messages = useMessageStore((s) =>
    currentChannelId ? (s.messageCache[currentChannelId]?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const hasMore = useMessageStore((s) =>
    currentChannelId ? (s.messageCache[currentChannelId]?.hasMore ?? true) : true
  );
  const { isLoading, prependMessages, setHasMore, updateReactions, togglePinLocal, addOptimisticMessage, replaceOptimisticMessage, removeOptimisticMessage } = useMessageStore();
  const user = useAuthStore((s) => s.user);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState<DOMRect | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; type: string; name: string; size: number; spoiler?: boolean }[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profilePopup, setProfilePopup] = useState<{ user: User; position: { x: number; y: number } } | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShouldAutoScroll(isNearBottom);

    if (container.scrollTop < 50 && hasMore && !isLoading && currentChannel) {
      const oldestMessage = messages[0];
      if (oldestMessage) {
        const prevHeight = container.scrollHeight;
        messageApi.getMessages(currentChannel._id, oldestMessage._id)
          .then(({ messages: older }) => {
            if (older.length === 0) {
              setHasMore(currentChannel._id, false);
            } else {
              prependMessages(currentChannel._id, older);
              requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight - prevHeight;
              });
            }
          })
          .catch(console.error);
      }
    }
  }, [hasMore, isLoading, currentChannel, messages, prependMessages, setHasMore]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerMsgId) return;
    const handler = () => {
      setEmojiPickerMsgId(null);
      setEmojiPickerAnchor(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [emojiPickerMsgId]);

  // Keyboard shortcuts: Ctrl+K search, Escape close modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (profilePopup) setProfilePopup(null);
        else if (emojiPickerMsgId) {
          setEmojiPickerMsgId(null);
          setEmojiPickerAnchor(null);
        }
        else if (editingId) setEditingId(null);
        else if (showPinned || showSearch) {
          setShowPinned(false);
          setShowSearch(false);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (currentChannel) {
          setShowSearch((s) => !s);
          if (!showSearch) setShowPinned(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [profilePopup, emojiPickerMsgId, editingId, showPinned, showSearch, currentChannel]);

  useEffect(() => {
    if (!currentServer) {
      setRoles([]);
      return;
    }
    roleApi.getRoles(currentServer._id).then(({ roles: r }) => setRoles(r)).catch(() => setRoles([]));
  }, [currentServer?._id]);

  // Typing indicator
  useEffect(() => {
    setTypingUsers({});
    if (!currentChannel) return;
    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== currentChannel._id || data.userId === user?._id) return;
      const uid = data.userId;
      setTypingUsers((prev) => {
        const next = { ...prev, [uid]: Date.now() };
        if (typingTimeoutsRef.current[uid]) clearTimeout(typingTimeoutsRef.current[uid]);
        typingTimeoutsRef.current[uid] = setTimeout(() => {
          setTypingUsers((p) => {
            const n = { ...p };
            delete n[uid];
            return n;
          });
          delete typingTimeoutsRef.current[uid];
        }, TYPING_TIMEOUT_MS);
        return next;
      });
    };

    socket.on('typingStart', handler);
    return () => {
      socket.off('typingStart', handler);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
    };
  }, [currentChannel, user?._id]);

  // === Send ===

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || !currentChannel || isSending || !user) return;
    const content = input.trim() || '';
    const replyToMsg = replyingTo;
    const attachmentsToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setInput('');
    setReplyingTo(null);
    setPendingAttachments([]);
    setIsSending(true);

    const optimisticMsg: Message = {
      _id: '',
      content,
      authorId: user,
      channelId: currentChannel._id,
      serverId: currentChannel.serverId,
      type: replyToMsg ? 'reply' : 'default',
      replyTo: replyToMsg ? { _id: replyToMsg._id, content: replyToMsg.content, authorId: replyToMsg.authorId } : null,
      attachments: (attachmentsToSend || []).map((a) => ({
        ...a,
        type: a.type as 'image' | 'video' | 'file',
        spoiler: a.spoiler || false,
      })),
      reactions: [],
      pinned: false,
      editedAt: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tempId = addOptimisticMessage(optimisticMsg);

    const socket = getSocket();
    if (socket) {
      socket.emit('sendMessage', {
        channelId: currentChannel._id,
        content,
        replyTo: replyToMsg?._id,
        attachments: attachmentsToSend?.map((a) => ({
          url: a.url,
          type: a.type,
          name: a.name,
          size: a.size,
          spoiler: a.spoiler || false,
        })),
      }, (res: { success: boolean; message?: Message; error?: string }) => {
        if (!res.success) {
          removeOptimisticMessage(tempId);
          setInput(content);
          setReplyingTo(replyToMsg);
          setPendingAttachments(attachmentsToSend || []);
          if (res.error) toast.error(res.error);
        } else if (res.message) {
          replaceOptimisticMessage(tempId, res.message);
        }
        setIsSending(false);
      });
    } else {
      removeOptimisticMessage(tempId);
      setInput(content);
      setReplyingTo(replyToMsg);
      setPendingAttachments(attachmentsToSend || []);
      setIsSending(false);
    }
  };

  const lastTypingEmitRef = useRef<number>(0);
  const handleInputChange = (value: string) => {
    setInput(value);
    if (currentChannel) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 2000) {
        lastTypingEmitRef.current = now;
        getSocket()?.emit('typingStart', currentChannel._id);
      }
    }
  };

  // === Edit ===

  const handleEdit = (message: Message) => {
    setEditingId(message._id);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return;
    getSocket()?.emit('editMessage', { messageId: editingId, content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  };

  // === Delete ===

  const handleDelete = (messageId: string) => {
    getSocket()?.emit('deleteMessage', messageId);
  };

  // === Reply ===

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  // === Reactions ===

  const handleReaction = (messageId: string, emoji: string) => {
    const myId = user?._id || '';
    const msg = messages.find((m) => m._id === messageId);
    if (msg) {
      const nextReactions = (msg.reactions || []).map((r) => ({ ...r, users: [...r.users] }));
      const existing = nextReactions.find((r) => r.emoji === emoji);
      const hasMe = existing?.users.some((u) => String(u) === myId);
      if (existing) {
        if (hasMe) {
          existing.users = existing.users.filter((u) => String(u) !== myId);
          if (existing.users.length === 0) {
            nextReactions.splice(nextReactions.indexOf(existing), 1);
          }
        } else {
          existing.users.push(myId);
        }
      } else {
        nextReactions.push({ emoji, users: [myId] });
      }
      updateReactions(messageId, nextReactions);
    }
    getSocket()?.emit('toggleReaction', { messageId, emoji });
    setEmojiPickerMsgId(null);
  };

  // reactionUpdated is handled in AppLayout for reliable delivery

  // === Pin ===

  const handleTogglePin = async (messageId: string) => {
    try {
      await messageApi.togglePin(messageId);
      togglePinLocal(messageId);
    } catch {
      toast.error('Failed to toggle pin');
    }
  };

  const loadPinnedMessages = async () => {
    if (!currentChannel) return;
    setLoadingPinned(true);
    try {
      const { messages: pinned } = await messageApi.getPinnedMessages(currentChannel._id);
      setPinnedMessages(pinned);
    } catch {
      toast.error('Failed to load pinned messages');
    } finally {
      setLoadingPinned(false);
    }
  };

  const togglePinnedPanel = () => {
    if (!showPinned) loadPinnedMessages();
    setShowPinned(!showPinned);
    setShowSearch(false);
  };

  // === Search ===

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentServer) return;
    setIsSearching(true);
    try {
      const { messages: results } = await messageApi.searchMessages(
        currentServer._id, searchQuery.trim(), currentChannel?._id
      );
      setSearchResults(results);
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSearchPanel = () => {
    setShowSearch(!showSearch);
    setShowPinned(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  // === Upload ===

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const { attachments } = await messageApi.uploadFiles(files);
      setPendingAttachments((prev) => [...prev, ...attachments.map((a) => ({ ...a, spoiler: false }))]);
    } catch {
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const togglePendingSpoiler = (index: number) => {
    setPendingAttachments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, spoiler: !a.spoiler } : a))
    );
  };

  // === Helpers ===

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const isDifferentDay = (curr: string, prev: string) =>
    new Date(curr).toDateString() !== new Date(prev).toDateString();

  const isOwner = currentServer?.ownerId === user?._id;

  // === Empty states ===

  if (!currentServer) {
    return (
      <div className="flex-1 flex items-center justify-center bg-layer-2">
        <div className="text-center">
          <div className="w-16 h-16 bg-layer-3 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-[#80848E] text-2xl font-bold">C</span>
          </div>
          <p className="text-white font-semibold mb-1">Welcome to Camp</p>
          <p className="text-[#80848E] text-sm">Select or create a server to get started</p>
        </div>
      </div>
    );
  }

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-layer-2">
        <div className="text-center">
          <div className="w-16 h-16 bg-layer-3 rounded-full flex items-center justify-center mx-auto mb-4">
            <Hash className="w-8 h-8 text-[#80848E]" />
          </div>
          <p className="text-white font-semibold mb-1">No channel selected</p>
          <p className="text-[#80848E] text-sm">Pick a text channel from the sidebar</p>
        </div>
      </div>
    );
  }

  // === Render message ===

  const renderMessage = (msg: Message, idx: number, list: Message[]) => {
    const showHeader = idx === 0 || (() => {
      const prev = list[idx - 1];
      if (prev.deleted) return true;
      const sameAuthor = prev.authorId._id === msg.authorId._id;
      const timeDiff = new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime();
      return !sameAuthor || timeDiff > 5 * 60 * 1000;
    })();

    if (msg.deleted) {
      return (
        <div key={msg._id} className="py-0.5 px-2">
          <span className="text-[#5C5F66] text-sm italic">Message deleted</span>
        </div>
      );
    }

    return (
      <div key={msg._id} className="group/msg hover:bg-layer-4/30 rounded px-2 py-0.5 relative">
        {/* Reply reference */}
        {msg.type === 'reply' && msg.replyTo && (
          <div className="flex items-center gap-1 text-xs text-[#80848E] ml-14 mb-0.5">
            <span className="text-accent-400">&#8627;</span>
            <span className="truncate max-w-xs">
              {typeof msg.replyTo.authorId === 'object'
                ? (msg.replyTo.authorId as { displayName?: string }).displayName
                : 'User'}
              : {msg.replyTo.content}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {showHeader ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const author = msg.authorId as User;
                setProfilePopup({
                  user: { ...author, status: (author.status || 'offline') as User['status'] },
                  position: { x: e.clientX, y: e.clientY },
                });
              }}
              className="w-10 h-10 rounded-full bg-accent-600 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-accent-400 transition-all overflow-hidden"
            >
              {(msg.authorId as User).avatar ? (
                <img src={(msg.authorId as User).avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {msg.authorId.displayName?.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          ) : (
            <div className="w-10 flex-shrink-0 flex items-center justify-center">
              <span className="text-[#5C5F66] text-2xs opacity-0 group-hover/msg:opacity-100 transition-opacity">
                {formatTime(msg.createdAt)}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {showHeader && (
              <div className="flex items-baseline gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const author = msg.authorId as User;
                    setProfilePopup({
                      user: { ...author, status: (author.status || 'offline') as User['status'] },
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  className="text-white font-medium text-sm hover:underline cursor-pointer"
                >
                  {msg.authorId.displayName}
                </button>
                <span className="text-[#80848E] text-xs">{formatTime(msg.createdAt)}</span>
                {msg.editedAt && <span className="text-[#5C5F66] text-xs">(edited)</span>}
                {msg.pinned && <Pin className="w-3 h-3 text-warning-400 inline" />}
              </div>
            )}

            {editingId === msg._id ? (
              <div className="mt-1">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-layer-3 text-[#B5BAC1] text-sm px-3 py-1.5 rounded border border-layer-5 focus:outline-none focus:border-accent-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <span className="text-[#5C5F66] text-xs">Press Enter to save, Escape to cancel</span>
              </div>
            ) : (
              <>
                <div className="text-[#B5BAC1] text-sm break-words">
                  <MarkdownContent content={msg.content} />
                </div>
                {msg.content && extractUrls(msg.content).slice(0, 3).map((url) => (
                  <LinkPreview key={url} url={url} />
                ))}
              </>
            )}

            {/* Attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {msg.attachments.map((att, i) => {
                  const spoilerKey = `${msg._id}-${i}`;
                  const isRevealed = revealedSpoilers.has(spoilerKey);
                  const isSpoiler = att.spoiler && !isRevealed;
                  return (
                  <div key={i}>
                    {att.type === 'image' ? (
                      <div
                        className={`relative max-w-[550px] max-h-[400px] rounded-lg border border-layer-5 overflow-hidden cursor-pointer ${isSpoiler ? 'select-none' : ''}`}
                        onClick={() => {
                          if (isSpoiler) {
                            setRevealedSpoilers((prev) => new Set(prev).add(spoilerKey));
                          } else {
                            setLightboxUrl(att.url);
                          }
                        }}
                      >
                        <img
                          src={att.url}
                          alt={att.name}
                          className={`w-full h-full object-contain transition-all ${isSpoiler ? 'blur-2xl pointer-events-none' : 'hover:brightness-110'}`}
                        />
                        {isSpoiler && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                            <span className="px-4 py-2 bg-black/80 text-white text-sm font-semibold rounded-full">SPOILER</span>
                          </div>
                        )}
                      </div>
                    ) : att.type === 'video' ? (
                      <video
                        src={att.url}
                        controls
                        className="max-w-[550px] max-h-[400px] rounded-lg border border-layer-5"
                      />
                    ) : (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-layer-3 px-3 py-2 rounded-lg border border-layer-5 hover:bg-layer-4 transition-colors"
                      >
                        <FileText className="w-5 h-5 text-accent-400" />
                        <div className="min-w-0">
                          <span className="text-accent-400 text-sm hover:underline block truncate max-w-[300px]">{att.name}</span>
                          <span className="text-[#5C5F66] text-xs">{(att.size / 1024).toFixed(0)} KB</span>
                        </div>
                      </a>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Reactions */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {msg.reactions.map((reaction) => {
                  const hasReacted = reaction.users.some((u) => String(u) === (user?._id || ''));
                  return (
                    <button
                      key={reaction.emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReaction(msg._id, reaction.emoji);
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-colors ${
                        hasReacted
                          ? 'bg-accent-500/20 border-accent-500 text-accent-200'
                          : 'bg-layer-3 border-layer-5 text-[#B5BAC1] hover:bg-layer-4'
                      }`}
                    >
                      <span>{reaction.emoji}</span>
                      <span className="font-medium">{reaction.users.length}</span>
                    </button>
                  );
                })}
                {/* Quick add reaction button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (emojiPickerMsgId === msg._id) {
                      setEmojiPickerMsgId(null);
                      setEmojiPickerAnchor(null);
                    } else {
                      setEmojiPickerMsgId(msg._id);
                      setEmojiPickerAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-layer-5 bg-layer-3 text-[#80848E] hover:bg-layer-4 hover:text-white cursor-pointer transition-colors"
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>+</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action bar */}
        {!editingId && (
          <div className="absolute -top-3.5 right-2 hidden group-hover/msg:flex bg-layer-3 border border-layer-5 rounded-md shadow-lg z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (emojiPickerMsgId === msg._id) {
                  setEmojiPickerMsgId(null);
                  setEmojiPickerAnchor(null);
                } else {
                  setEmojiPickerMsgId(msg._id);
                  setEmojiPickerAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
                }
              }}
              className="px-2 py-1 text-[#80848E] hover:text-white transition-colors cursor-pointer"
              title="Add reaction"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReply(msg);
              }}
              className="px-2 py-1 text-[#80848E] hover:text-white transition-colors cursor-pointer"
              title="Reply"
            >
              <Reply className="w-4 h-4" />
            </button>
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin(msg._id);
                }}
                className={`px-2 py-1 transition-colors cursor-pointer ${msg.pinned ? 'text-warning-400' : 'text-[#80848E] hover:text-white'}`}
                title={msg.pinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-4 h-4" />
              </button>
            )}
            {msg.authorId._id === user?._id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(msg);
                }}
                className="px-2 py-1 text-[#80848E] hover:text-white text-xs transition-colors cursor-pointer"
              >
                Edit
              </button>
            )}
            {(msg.authorId._id === user?._id || isOwner) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(msg._id);
                }}
                className="px-2 py-1 text-[#80848E] hover:text-danger-400 text-xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Emoji picker - rendered via portal when this message has it open */}
        {emojiPickerMsgId === msg._id && emojiPickerAnchor && createPortal(
          <div
            className="fixed z-[100] rounded-lg overflow-hidden border border-layer-5 shadow-xl"
            style={{
              left: Math.max(8, Math.min(emojiPickerAnchor.right - 320, window.innerWidth - 328)),
              top: emojiPickerAnchor.top - 408 < 8
                ? emojiPickerAnchor.bottom + 4
                : Math.max(8, emojiPickerAnchor.top - 408),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              theme={Theme.DARK}
              width={320}
              height={400}
              onEmojiClick={(data) => {
                handleReaction(msg._id, data.emoji);
                setEmojiPickerMsgId(null);
                setEmojiPickerAnchor(null);
              }}
            />
          </div>,
          document.body
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-layer-2 min-w-0">
      {/* Channel header */}
      <div className="min-h-12 px-4 py-2 flex flex-col justify-center border-b border-layer-3 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {showChannelMenu && (
            <button
              onClick={onOpenChannelSidebar}
              className="p-1.5 rounded text-[#80848E] hover:text-white hover:bg-layer-4 transition-colors -ml-1 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:ring-offset-2 focus:ring-offset-layer-2"
              aria-label="Open channel list"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {currentServer?.name && (
            <>
              <span className="text-white font-semibold text-sm truncate max-w-[120px]">{currentServer.name}</span>
              <span className="text-[#80848E] text-sm">/</span>
            </>
          )}
          <Hash className="w-5 h-5 text-[#80848E] shrink-0" />
          <span className="text-white font-semibold text-sm truncate flex-1 min-w-0">{currentChannel.name}</span>
          <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePinnedPanel}
            className={`p-1.5 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:ring-offset-2 focus:ring-offset-layer-2 ${showPinned ? 'text-white bg-layer-4' : 'text-[#80848E] hover:text-white'}`}
            title="Pinned messages"
            aria-label="Toggle pinned messages"
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSearchPanel}
            className={`p-1.5 rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:ring-offset-2 focus:ring-offset-layer-2 ${showSearch ? 'text-white bg-layer-4' : 'text-[#80848E] hover:text-white'}`}
            title="Search"
            aria-label="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>
          {showMemberMenu && onOpenMemberList && (
            <button
              onClick={onOpenMemberList}
              className="p-1.5 rounded transition-colors cursor-pointer text-[#80848E] hover:text-white hover:bg-layer-4 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:ring-offset-2 focus:ring-offset-layer-2"
              aria-label="Open member list"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
          <InboxButton />
          </div>
        </div>
        {currentChannel.topic && (
          <div className="mt-0.5 ml-7 flex items-center gap-1">
            <span className="text-[#80848E] text-xs" title={currentChannel.topic}>
              {currentChannel.topic.length > 100
                ? `${currentChannel.topic.slice(0, 100)}...`
                : currentChannel.topic}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-2"
            role="log"
            aria-label="Message list"
          >
            {isLoading && messages.length === 0 && (
              <MessageSkeleton />
            )}

            {!hasMore && messages.length > 0 && (
              <div className="py-4 mb-2">
                <h3 className="text-2xl font-bold text-white">Welcome to #{currentChannel.name}</h3>
                <p className="text-[#80848E] text-sm mt-1">This is the beginning of the channel.</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const showDate = idx === 0 || isDifferentDay(msg.createdAt, messages[idx - 1].createdAt);
              return (
                <div key={msg._id}>
                  {showDate && (
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-layer-4" />
                      <span className="text-[#80848E] text-xs font-semibold">{formatDate(msg.createdAt)}</span>
                      <div className="flex-1 h-px bg-layer-4" />
                    </div>
                  )}
                  {renderMessage(msg, idx, messages)}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply preview */}
          {replyingTo && (
            <div className="px-4 pt-2 flex items-center gap-2 bg-layer-2">
              <div className="flex-1 bg-layer-3 rounded-t-lg px-3 py-2 flex items-center gap-2 border-l-2 border-accent-500">
                <Reply className="w-4 h-4 text-accent-400 flex-shrink-0" />
                <span className="text-accent-400 text-xs font-medium">{replyingTo.authorId.displayName}</span>
                <span className="text-[#80848E] text-xs truncate">{replyingTo.content}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-[#80848E] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="px-4 py-1 flex items-center gap-1 text-[#80848E] text-sm">
              <div className="flex gap-1">
                {Object.keys(typingUsers).map((uid) => {
                  const m = members.find((x) => x._id === uid);
                  return (
                    <span key={uid} className="font-medium text-accent-400">
                      {m?.displayName || 'Someone'}
                    </span>
                  );
                })}
              </div>
              <span>
                {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="px-4 pt-2 flex flex-wrap gap-3 bg-layer-2">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="relative group">
                  <div className="absolute -top-1 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePendingSpoiler(i)}
                      className="w-7 h-7 rounded-full bg-layer-4 hover:bg-layer-5 flex items-center justify-center text-[#B5BAC1] hover:text-white cursor-pointer"
                      title={att.spoiler ? 'Spoiler Attachment' : 'Mark as Spoiler'}
                    >
                      {att.spoiler ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => removePendingAttachment(i)}
                      className="w-7 h-7 rounded-full bg-layer-4 hover:bg-danger-500 flex items-center justify-center text-[#B5BAC1] hover:text-white cursor-pointer"
                      title="Remove Attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="bg-layer-3 rounded-lg overflow-hidden border border-layer-5 w-[200px]">
                    {att.type === 'image' ? (
                      <div className="relative">
                        <img
                          src={att.url}
                          alt={att.name}
                          onClick={() => setLightboxUrl(att.url)}
                          className={`max-w-[200px] max-h-[150px] w-full object-cover cursor-pointer hover:brightness-110 transition-all ${att.spoiler ? 'blur-xl' : ''}`}
                        />
                        {att.spoiler && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                            <span className="px-3 py-1 bg-black/80 text-white text-xs font-semibold rounded-full">SPOILER</span>
                          </div>
                        )}
                      </div>
                    ) : att.type === 'video' ? (
                      <video src={att.url} className="max-w-[200px] max-h-[150px] rounded" muted />
                    ) : (
                      <div className="w-[200px] h-[80px] flex items-center gap-3 px-3">
                        <FileText className="w-8 h-8 text-accent-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[#B5BAC1] text-sm block truncate">{att.name}</span>
                          <span className="text-[#5C5F66] text-xs">{(att.size / 1024).toFixed(0)} KB</span>
                        </div>
                      </div>
                    )}
                    <div className="px-2 py-1.5 border-t border-layer-5">
                      <span className="text-[#80848E] text-xs truncate block">{att.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message input */}
          <div className="px-4 pb-4 pt-1 flex-shrink-0">
            <div className={`bg-layer-3 flex items-center px-4 ${replyingTo ? 'rounded-b-lg' : 'rounded-lg'}`}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[#80848E] hover:text-white transition-colors mr-2 cursor-pointer disabled:opacity-50"
                title="Upload file"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,.pdf,.txt,.zip,.rar"
                onChange={handleFileSelect}
              />
              <input
                ref={messageInputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                  if (e.key === 'Escape' && replyingTo) {
                    setReplyingTo(null);
                  }
                }}
                className="flex-1 bg-transparent text-[#B5BAC1] placeholder-[#5C5F66] py-3 focus:outline-none text-sm"
                placeholder={replyingTo ? `Reply to ${replyingTo.authorId.displayName}` : `Message #${currentChannel.name}`}
              />
              {currentChannel && user && (
                <MentionAutocomplete
                  inputRef={messageInputRef}
                  value={input}
                  onChange={(v) => setInput(v)}
                  members={members}
                  roles={roles}
                  currentUserId={user._id}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right panel: Pinned / Search */}
        {(showPinned || showSearch) && (
          <div className="w-80 border-l border-layer-3 bg-layer-1 flex flex-col flex-shrink-0">
            {showPinned && (
              <>
                <div className="h-12 px-4 flex items-center justify-between border-b border-layer-3 flex-shrink-0">
                  <span className="text-white font-semibold text-sm">Pinned Messages</span>
                  <button onClick={() => setShowPinned(false)} className="text-[#80848E] hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loadingPinned ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : pinnedMessages.length === 0 ? (
                    <p className="text-[#80848E] text-sm text-center py-8">No pinned messages</p>
                  ) : (
                    pinnedMessages.map((msg) => (
                      <div key={msg._id} className="bg-layer-2 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-medium">{msg.authorId.displayName}</span>
                          <span className="text-[#5C5F66] text-xs">{formatTime(msg.createdAt)}</span>
                        </div>
                        <MarkdownContent content={msg.content} />
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {showSearch && (
              <>
                <div className="h-12 px-4 flex items-center justify-between border-b border-layer-3 flex-shrink-0">
                  <span className="text-white font-semibold text-sm">Search</span>
                  <button onClick={() => setShowSearch(false)} className="text-[#80848E] hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="input w-full text-sm"
                    placeholder="Search messages... (Ctrl+K)"
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-[#80848E] text-sm text-center py-8">
                      {searchQuery ? 'No results found' : 'Type a keyword and press Enter'}
                    </p>
                  ) : (
                    searchResults.map((msg) => (
                      <div key={msg._id} className="bg-layer-2 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-medium">{msg.authorId.displayName}</span>
                          <span className="text-[#5C5F66] text-xs">{formatDate(msg.createdAt)}</span>
                        </div>
                        <MarkdownContent content={msg.content} />
                        {(msg.channelId as unknown as { name: string })?.name && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-[#5C5F66]">
                            <Hash className="w-3 h-3" />
                            <span>{(msg.channelId as unknown as { name: string }).name}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* User profile popup */}
      {profilePopup && (
        <UserProfilePopup
          user={profilePopup.user}
          position={profilePopup.position}
          onClose={() => setProfilePopup(null)}
          onOpenDM={onOpenDM}
        />
      )}

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 bg-layer-3 text-white px-4 py-2 rounded-lg text-sm hover:bg-layer-4 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Open original
          </a>
        </div>
      )}
    </div>
  );
}

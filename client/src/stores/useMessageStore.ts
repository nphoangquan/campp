import { create } from 'zustand';
import type { Message, Reaction } from '../types';

interface ChannelCache {
  messages: Message[];
  hasMore: boolean;
}

interface MessageState {
  messageCache: Record<string, ChannelCache>;
  currentChannelId: string | null;
  isLoading: boolean;
  setCurrentChannelId: (channelId: string | null) => void;
  setMessages: (channelId: string, messages: Message[], hasMore: boolean) => void;
  addMessage: (message: Message) => void;
  addOptimisticMessage: (message: Message) => string;
  replaceOptimisticMessage: (tempId: string, realMessage: Message) => void;
  removeOptimisticMessage: (tempId: string) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  updateReactions: (messageId: string, reactions: Reaction[]) => void;
  togglePinLocal: (messageId: string) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
  clearChannel: (channelId: string) => void;
  getMessagesForChannel: (channelId: string | null) => Message[];
  getHasMoreForChannel: (channelId: string | null) => boolean;
  hasCachedMessages: (channelId: string) => boolean;
}

const updateMessageInCache = (cache: Record<string, ChannelCache>, messageId: string, updater: (m: Message) => Message): Record<string, ChannelCache> => {
  const next = { ...cache };
  for (const [cid, data] of Object.entries(next)) {
    const idx = data.messages.findIndex((m) => m._id === messageId);
    if (idx >= 0) {
      const messages = [...data.messages];
      messages[idx] = updater(messages[idx]);
      next[cid] = { ...data, messages };
      break;
    }
  }
  return next;
};

export const useMessageStore = create<MessageState>((set, get) => ({
  messageCache: {},
  currentChannelId: null,
  isLoading: false,

  setCurrentChannelId: (channelId) => set({ currentChannelId: channelId }),

  setMessages: (channelId, messages, hasMore) =>
    set((s) => ({
      messageCache: {
        ...s.messageCache,
        [channelId]: { messages, hasMore },
      },
    })),

  addMessage: (message) =>
    set((s) => {
      const channelId = (message.channelId as string);
      const existing = s.messageCache[channelId];
      if (!existing) return s;
      const already = existing.messages.some((m) => m._id === message._id);
      if (already) return s;
      return {
        messageCache: {
          ...s.messageCache,
          [channelId]: {
            ...existing,
            messages: [...existing.messages, message],
          },
        },
      };
    }),

  addOptimisticMessage: (message) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channelId = (message.channelId as string);
    const optimistic = { ...message, _id: tempId };
    set((s) => {
      const existing = s.messageCache[channelId] ?? { messages: [], hasMore: true };
      return {
        messageCache: {
          ...s.messageCache,
          [channelId]: {
            ...existing,
            messages: [...existing.messages, optimistic],
          },
        },
      };
    });
    return tempId;
  },

  replaceOptimisticMessage: (tempId, realMessage) =>
    set((s) => {
      const channelId = (realMessage.channelId as string);
      const existing = s.messageCache[channelId];
      if (!existing) return s;
      return {
        messageCache: {
          ...s.messageCache,
          [channelId]: {
            ...existing,
            messages: existing.messages.map((m) => (m._id === tempId ? realMessage : m)),
          },
        },
      };
    }),

  removeOptimisticMessage: (tempId) =>
    set((s) => {
      let next = { ...s.messageCache };
      for (const [cid, data] of Object.entries(next)) {
        const filtered = data.messages.filter((m) => m._id !== tempId);
        if (filtered.length !== data.messages.length) {
          next = { ...next, [cid]: { ...data, messages: filtered } };
          break;
        }
      }
      return { messageCache: next };
    }),

  prependMessages: (channelId, messages) =>
    set((s) => {
      const existing = s.messageCache[channelId];
      if (!existing) return s;
      const ids = new Set(existing.messages.map((m) => m._id));
      const newOnes = messages.filter((m) => !ids.has(m._id));
      if (newOnes.length === 0) return s;
      return {
        messageCache: {
          ...s.messageCache,
          [channelId]: {
            ...existing,
            messages: [...newOnes, ...existing.messages],
          },
        },
      };
    }),

  updateMessage: (message) =>
    set((s) => ({
      messageCache: updateMessageInCache(s.messageCache, message._id, () => message),
    })),

  removeMessage: (messageId) =>
    set((s) => ({
      messageCache: updateMessageInCache(s.messageCache, messageId, (m) => ({
        ...m,
        deleted: true,
        content: '',
      })),
    })),

  updateReactions: (messageId, reactions) =>
    set((s) => ({
      messageCache: updateMessageInCache(s.messageCache, messageId, (m) => ({ ...m, reactions })),
    })),

  togglePinLocal: (messageId) =>
    set((s) => ({
      messageCache: updateMessageInCache(s.messageCache, messageId, (m) => ({ ...m, pinned: !m.pinned })),
    })),

  setHasMore: (channelId, hasMore) =>
    set((s) => {
      const existing = s.messageCache[channelId];
      if (!existing) return s;
      return {
        messageCache: {
          ...s.messageCache,
          [channelId]: { ...existing, hasMore },
        },
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  clear: () => set({ messageCache: {}, currentChannelId: null, isLoading: false }),

  clearChannel: (channelId) =>
    set((s) => {
      const next = { ...s.messageCache };
      delete next[channelId];
      return { messageCache: next };
    }),

  getMessagesForChannel: (channelId) => {
    if (!channelId) return [];
    return get().messageCache[channelId]?.messages ?? [];
  },

  getHasMoreForChannel: (channelId) => {
    if (!channelId) return true;
    return get().messageCache[channelId]?.hasMore ?? true;
  },

  hasCachedMessages: (channelId) => {
    const data = get().messageCache[channelId];
    return !!(data && data.messages.length > 0);
  },
}));

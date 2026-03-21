import { create } from 'zustand';
import type { Conversation, DirectMessage, User, UserStatus } from '../types';

interface DMState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: DirectMessage[];
  friends: User[];
  incoming: User[];
  outgoing: User[];
  loading: boolean;
  hasMore: boolean;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: DirectMessage[]) => void;
  addMessage: (message: DirectMessage) => void;
  prependMessages: (messages: DirectMessage[]) => void;
  setFriends: (friends: User[], incoming: User[], outgoing: User[]) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  clearMessages: () => void;
  updateConversationLastMessage: (conversationId: string, message: DirectMessage) => void;
  updateParticipantStatus: (userId: string, status: string) => void;
}

export const useDMStore = create<DMState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  hasMore: false,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => {
    const exists = s.messages.some((m) => m._id === message._id);
    if (exists) return s;
    return { messages: [...s.messages, message] };
  }),
  prependMessages: (messages) => set((s) => ({ messages: [...messages, ...s.messages] })),
  setFriends: (friends, incoming, outgoing) => set({ friends, incoming, outgoing }),
  setLoading: (loading) => set({ loading }),
  setHasMore: (hasMore) => set({ hasMore }),
  clearMessages: () => set({ messages: [], hasMore: false }),
  updateConversationLastMessage: (conversationId, message) => set((s) => ({
    conversations: s.conversations.map((c) =>
      c._id === conversationId
        ? { ...c, lastMessage: { _id: message._id, content: message.content, authorId: { displayName: message.authorId.displayName }, createdAt: message.createdAt, deleted: message.deleted }, updatedAt: message.createdAt }
        : c
    ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  })),
  updateParticipantStatus: (userId, status) => set((s) => {
    const mapPart = (p: User) => (String(p._id) === userId ? { ...p, status: status as UserStatus } : p);
    return {
      conversations: s.conversations.map((c) => ({ ...c, participants: c.participants.map(mapPart) })),
      currentConversation: s.currentConversation
        ? { ...s.currentConversation, participants: s.currentConversation.participants.map(mapPart) }
        : s.currentConversation,
    };
  }),
}));

import { create } from 'zustand';
import type { ServerData, Category, Channel, User } from '../types';

interface ServerState {
  servers: ServerData[];
  currentServer: ServerData | null;
  categories: Category[];
  uncategorizedChannels: Channel[];
  currentChannel: Channel | null;
  members: User[];
  unreadCounts: Record<string, number>;
  setServers: (servers: ServerData[]) => void;
  addServer: (server: ServerData) => void;
  updateServer: (server: ServerData) => void;
  removeServer: (serverId: string) => void;
  setCurrentServer: (server: ServerData | null) => void;
  setChannelData: (categories: Category[], uncategorized: Channel[]) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMembers: (members: User[]) => void;
  updateMemberStatus: (userId: string, status: string) => void;
  updateMemberProfile: (userId: string, profile: Partial<Pick<User, 'avatar' | 'banner' | 'displayName' | 'activityStatus'>>) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  clearUnread: (channelId: string) => void;
  incrementUnread: (channelId: string) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  currentServer: null,
  categories: [],
  uncategorizedChannels: [],
  currentChannel: null,
  members: [],
  unreadCounts: {},

  setServers: (servers) => set({ servers }),
  addServer: (server) => set((s) => {
    const exists = s.servers.some((sv) => sv._id === server._id);
    if (exists) return { servers: s.servers };
    return { servers: [...s.servers, server] };
  }),
  updateServer: (server) => set((s) => ({
    servers: s.servers.map((sv) => (sv._id === server._id ? server : sv)),
    currentServer: s.currentServer?._id === server._id ? server : s.currentServer,
  })),
  removeServer: (serverId) => set((s) => ({
    servers: s.servers.filter((sv) => sv._id !== serverId),
    currentServer: s.currentServer?._id === serverId ? null : s.currentServer,
  })),
  setCurrentServer: (server) => set({ currentServer: server }),
  setChannelData: (categories, uncategorized) => set({
    categories,
    uncategorizedChannels: uncategorized,
  }),
  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  setMembers: (members) => set({ members }),
  updateMemberStatus: (userId, status) => set((s) => ({
    members: s.members.map((m) =>
      m._id === userId ? { ...m, status: status as User['status'] } : m
    ),
  })),
  updateMemberProfile: (userId, profile) => set((s) => ({
    members: s.members.map((m) =>
      m._id === userId ? { ...m, ...profile } : m
    ),
  })),
  setUnreadCounts: (counts) => set({ unreadCounts: counts }),
  clearUnread: (channelId) => set((s) => {
    const next = { ...s.unreadCounts };
    delete next[channelId];
    return { unreadCounts: next };
  }),
  incrementUnread: (channelId) => set((s) => ({
    unreadCounts: {
      ...s.unreadCounts,
      [channelId]: (s.unreadCounts[channelId] || 0) + 1,
    },
  })),
}));

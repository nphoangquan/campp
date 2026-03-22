import apiClient from './client';
import type { ServerData, Category, Channel, User } from '../../types';

export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  categories: { name: string; channels: { name: string; type: 'text' | 'voice' }[] }[];
}

export const serverApi = {
  getMyServers: async (): Promise<{ servers: ServerData[] }> => {
    const res = await apiClient.get('/servers/me');
    return res.data;
  },

  getTemplates: async (): Promise<{ templates: ServerTemplate[] }> => {
    const res = await apiClient.get('/servers/templates');
    return res.data;
  },

  createServer: async (name: string, templateId?: string): Promise<{ server: ServerData }> => {
    const res = await apiClient.post('/servers', { name, templateId });
    return res.data;
  },

  getServer: async (serverId: string): Promise<{ server: ServerData }> => {
    const res = await apiClient.get(`/servers/${serverId}`);
    return res.data;
  },

  updateServer: async (serverId: string, data: { name?: string; description?: string; icon?: string; banner?: string }): Promise<{ server: ServerData }> => {
    const res = await apiClient.patch(`/servers/${serverId}`, data);
    return res.data;
  },

  deleteServer: async (serverId: string): Promise<void> => {
    await apiClient.delete(`/servers/${serverId}`);
  },

  getInvitePreview: async (inviteCode: string): Promise<{ name: string; icon: string; banner: string; memberCount: number; onlineCount: number }> => {
    const res = await apiClient.get(`/invite/${inviteCode}/preview`);
    return res.data;
  },

  regenerateInvite: async (serverId: string): Promise<{ server: ServerData }> => {
    const res = await apiClient.post(`/servers/${serverId}/regenerate-invite`);
    return res.data;
  },

  joinByInvite: async (inviteCode: string): Promise<{ server: ServerData; alreadyMember: boolean }> => {
    const res = await apiClient.post(`/servers/join/${inviteCode}`);
    return res.data;
  },

  leaveServer: async (serverId: string): Promise<void> => {
    await apiClient.post(`/servers/${serverId}/leave`);
  },

  getMembers: async (
    serverId: string,
    opts?: { search?: string; limit?: number; offset?: number }
  ): Promise<{ members: User[]; total?: number; hasMore?: boolean }> => {
    const params = new URLSearchParams();
    if (opts?.search) params.set('search', opts.search);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const q = params.toString();
    const res = await apiClient.get(`/servers/${serverId}/members${q ? `?${q}` : ''}`);
    return res.data;
  },

  getChannels: async (serverId: string): Promise<{ categories: Category[]; uncategorized: Channel[] }> => {
    const res = await apiClient.get(`/servers/${serverId}/channels`);
    return res.data;
  },

  getUnreadCounts: async (serverId: string): Promise<{ unreadCounts: Record<string, number> }> => {
    const res = await apiClient.get(`/servers/${serverId}/unread-counts`);
    return res.data;
  },

  markChannelRead: async (channelId: string): Promise<void> => {
    await apiClient.post(`/channels/${channelId}/read`);
  },

  createCategory: async (serverId: string, name: string): Promise<{ category: Category }> => {
    const res = await apiClient.post(`/servers/${serverId}/categories`, { name });
    return res.data;
  },

  updateCategory: async (categoryId: string, name: string): Promise<{ category: Category }> => {
    const res = await apiClient.patch(`/servers/categories/${categoryId}`, { name });
    return res.data;
  },

  createChannel: async (serverId: string, data: { name: string; type?: string; categoryId?: string }): Promise<{ channel: Channel }> => {
    const res = await apiClient.post(`/servers/${serverId}/channels`, data);
    return res.data;
  },

  updateChannel: async (channelId: string, data: { name?: string; topic?: string }): Promise<{ channel: Channel }> => {
    const res = await apiClient.patch(`/servers/channels/${channelId}`, data);
    return res.data;
  },

  deleteChannel: async (channelId: string): Promise<void> => {
    await apiClient.delete(`/servers/channels/${channelId}`);
  },

  deleteCategory: async (categoryId: string): Promise<void> => {
    await apiClient.delete(`/servers/categories/${categoryId}`);
  },
};

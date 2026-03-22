import apiClient from './client';
import { useAuthStore } from '../../stores/useAuthStore';
import type { Message, Attachment, Reaction } from '../../types';

export const messageApi = {
  getMessages: async (channelId: string, before?: string): Promise<{ messages: Message[] }> => {
    const params: Record<string, string> = {};
    if (before) params.before = before;
    const res = await apiClient.get(`/channels/${channelId}/messages`, { params });
    return res.data;
  },

  sendMessage: async (channelId: string, data: {
    content: string;
    replyTo?: string;
    attachments?: Attachment[];
  }): Promise<{ message: Message }> => {
    const res = await apiClient.post(`/channels/${channelId}/messages`, data);
    return res.data;
  },

  editMessage: async (messageId: string, content: string): Promise<{ message: Message }> => {
    const res = await apiClient.patch(`/channels/messages/${messageId}`, { content });
    return res.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/channels/messages/${messageId}`);
  },

  toggleReaction: async (messageId: string, emoji: string): Promise<{ reactions: Reaction[]; channelId: string }> => {
    const res = await apiClient.post(`/channels/messages/${messageId}/reactions`, { emoji });
    return res.data;
  },

  togglePin: async (messageId: string): Promise<{ message: Message }> => {
    const res = await apiClient.patch(`/channels/messages/${messageId}/pin`);
    return res.data;
  },

  getPinnedMessages: async (channelId: string): Promise<{ messages: Message[] }> => {
    const res = await apiClient.get(`/channels/${channelId}/pinned`);
    return res.data;
  },

  searchMessages: async (serverId: string, query: string, channelId?: string): Promise<{ messages: Message[]; query: string }> => {
    const params: Record<string, string> = { q: query };
    if (channelId) params.channelId = channelId;
    const res = await apiClient.get(`/search/${serverId}`, { params });
    return res.data;
  },

  uploadFiles: async (files: File[]): Promise<{ attachments: Attachment[] }> => {
    if (!files?.length) throw new Error('No files provided');
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const uploadUrl = `${baseUrl.replace(/\/$/, '')}/upload`;
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: string })?.error;
      if (res.status === 503 && msg?.includes('not configured')) {
        throw new Error('File upload is not configured. Set CLOUDINARY_* in server .env.');
      }
      if (res.status === 400 && msg?.includes('No files provided')) {
        throw new Error('Upload failed. Set VITE_API_URL=http://localhost:5000/api in client .env to fix proxy issues.');
      }
      throw new Error(msg || 'Upload failed');
    }
    return res.json();
  },
};

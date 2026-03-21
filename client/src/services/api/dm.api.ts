import apiClient from './client';
import type { Conversation, DirectMessage } from '../../types';

export const dmApi = {
  getConversations: async (): Promise<{ conversations: Conversation[] }> => {
    const res = await apiClient.get('/dm/conversations');
    return res.data;
  },
  getOrCreateConversation: async (targetId: string): Promise<{ conversation: Conversation }> => {
    const res = await apiClient.post(`/dm/conversations/${targetId}`);
    return res.data;
  },
  getMessages: async (conversationId: string, before?: string): Promise<{ messages: DirectMessage[] }> => {
    const params = before ? { before } : {};
    const res = await apiClient.get(`/dm/${conversationId}/messages`, { params });
    return res.data;
  },
  sendMessage: async (conversationId: string, data: { content: string; attachments?: { url: string; type: string; name: string; size: number }[] }): Promise<{ message: DirectMessage }> => {
    const res = await apiClient.post(`/dm/${conversationId}/messages`, data);
    return res.data;
  },
};

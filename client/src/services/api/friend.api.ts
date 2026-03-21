import apiClient from './client';
import type { User } from '../../types';

export const friendApi = {
  searchUsers: async (query: string): Promise<{ users: User[] }> => {
    const res = await apiClient.get('/friends/search', { params: { q: query.trim() } });
    return res.data;
  },
  sendRequestByUsername: async (username: string): Promise<{ user?: User }> => {
    const res = await apiClient.post('/friends/request-by-username', { username: username.trim() });
    return res.data;
  },
  getFriends: async (): Promise<{ friends: User[]; incoming: User[]; outgoing: User[] }> => {
    const res = await apiClient.get('/friends');
    return res.data;
  },
  sendRequest: async (targetId: string): Promise<void> => {
    await apiClient.post(`/friends/request/${targetId}`);
  },
  acceptRequest: async (targetId: string): Promise<{ conversationId: string }> => {
    const res = await apiClient.post(`/friends/accept/${targetId}`);
    return res.data;
  },
  declineRequest: async (targetId: string): Promise<void> => {
    await apiClient.post(`/friends/decline/${targetId}`);
  },
  cancelRequest: async (targetId: string): Promise<void> => {
    await apiClient.post(`/friends/cancel/${targetId}`);
  },
  removeFriend: async (targetId: string): Promise<void> => {
    await apiClient.delete(`/friends/${targetId}`);
  },
};

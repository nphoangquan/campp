import apiClient from './client';

export interface NotificationItem {
  _id: string;
  type: 'mention' | 'everyone' | 'here' | 'dm';
  messageId: string;
  channelId: string | { _id: string; name: string };
  serverId?: string | { _id: string; name: string; icon?: string };
  authorId: { _id: string; username: string; displayName: string; avatar?: string };
  read: boolean;
  createdAt: string;
}

export interface UnreadItem {
  channelId: string;
  channelName: string;
  serverId: string;
  serverName: string;
  lastMessageAt: string;
  unreadCount: number;
}

export const notificationApi = {
  getNotifications: async (tab: 'for-you' | 'unreads' | 'mentions'): Promise<{
    notifications?: NotificationItem[];
    unreads?: UnreadItem[];
  }> => {
    const res = await apiClient.get(`/notifications?tab=${tab}`);
    return res.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};

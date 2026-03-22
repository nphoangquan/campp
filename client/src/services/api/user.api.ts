import apiClient from './client';
import type { User } from '../../types';

export const userApi = {
  updateProfile: async (data: {
    username?: string;
    displayName?: string;
    avatar?: string;
    banner?: string;
    activityStatus?: string;
  }): Promise<{ user: User }> => {
    const res = await apiClient.put<{ user: User }>('/users/me', data);
    return res.data;
  },

  updatePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    const res = await apiClient.put<{ message: string }>('/users/me/password', data);
    return res.data;
  },

  getMutedServers: async (): Promise<{ mutedServers: string[] }> => {
    const res = await apiClient.get<{ mutedServers: string[] }>('/users/me/muted-servers');
    return res.data;
  },

  toggleMuteServer: async (serverId: string): Promise<{ muted: boolean; mutedServers: string[] }> => {
    const res = await apiClient.patch<{ muted: boolean; mutedServers: string[] }>(
      `/users/me/muted-servers/${serverId}`
    );
    return res.data;
  },

  updatePrivacySettings: async (data: {
    allowDMs?: boolean;
    allowFriendRequests?: 'everyone' | 'friends_of_friends' | 'none';
  }): Promise<{ allowDMs: boolean; allowFriendRequests: string }> => {
    const res = await apiClient.patch<{ allowDMs: boolean; allowFriendRequests: string }>(
      '/users/me/privacy',
      data
    );
    return res.data;
  },

  updateNotificationSettings: async (data: {
    notificationSound?: boolean;
    desktopNotifications?: boolean;
  }): Promise<{ notificationSound: boolean; desktopNotifications: boolean }> => {
    const res = await apiClient.patch<{ notificationSound: boolean; desktopNotifications: boolean }>(
      '/users/me/notifications',
      data
    );
    return res.data;
  },
};

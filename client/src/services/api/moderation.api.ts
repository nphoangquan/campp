import apiClient from './client';
import type { Role, BanEntry, AuditLogEntry } from '../../types';

export const roleApi = {
  getRoles: async (serverId: string): Promise<{ roles: Role[] }> => {
    const res = await apiClient.get(`/servers/${serverId}/roles`);
    return res.data;
  },
  createRole: async (serverId: string, data: { name: string; color?: string; permissions?: number }): Promise<{ role: Role }> => {
    const res = await apiClient.post(`/servers/${serverId}/roles`, data);
    return res.data;
  },
  updateRole: async (roleId: string, data: { name?: string; color?: string; permissions?: number }): Promise<{ role: Role }> => {
    const res = await apiClient.patch(`/servers/roles/${roleId}`, data);
    return res.data;
  },
  deleteRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`/servers/roles/${roleId}`);
  },
  assignRole: async (serverId: string, memberId: string, roleType: string): Promise<void> => {
    await apiClient.patch(`/servers/${serverId}/members/${memberId}/role`, { role: roleType });
  },
  addCustomRoleToMember: async (serverId: string, memberId: string, roleId: string): Promise<{ member: { userId: string; role: string; customRoleIds: string[] } }> => {
    const res = await apiClient.post(`/servers/${serverId}/members/${memberId}/roles/${roleId}`);
    return res.data;
  },
  removeCustomRoleFromMember: async (serverId: string, memberId: string, roleId: string): Promise<{ member: { userId: string; role: string; customRoleIds: string[] } }> => {
    const res = await apiClient.delete(`/servers/${serverId}/members/${memberId}/roles/${roleId}`);
    return res.data;
  },
};

export const moderationApi = {
  kick: async (serverId: string, memberId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/moderation/${serverId}/kick/${memberId}`, { reason });
  },
  ban: async (serverId: string, memberId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/moderation/${serverId}/ban/${memberId}`, { reason });
  },
  unban: async (serverId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/moderation/${serverId}/ban/${memberId}`);
  },
  mute: async (serverId: string, memberId: string, duration: number, reason?: string): Promise<void> => {
    await apiClient.post(`/moderation/${serverId}/mute/${memberId}`, { duration, reason });
  },
  unmute: async (serverId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/moderation/${serverId}/mute/${memberId}`);
  },
  getBans: async (serverId: string): Promise<{ bans: BanEntry[] }> => {
    const res = await apiClient.get(`/moderation/${serverId}/bans`);
    return res.data;
  },
  getAuditLog: async (serverId: string): Promise<{ logs: AuditLogEntry[] }> => {
    const res = await apiClient.get(`/moderation/${serverId}/audit-log`);
    return res.data;
  },
};

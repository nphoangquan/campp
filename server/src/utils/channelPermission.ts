import { ALL_PERMISSIONS, computeMemberPermissions, Permissions, getRolePermissions } from './permissions';
import type { IChannel } from '../models/Channel';
import type { IServer } from '../models/Server';

/**
 * Compute effective permissions for a user in a channel.
 * Owner always gets full access. Otherwise uses role-based permissions + channel overrides.
 */
export async function getMemberChannelPermissions(
  userId: string,
  channel: IChannel,
  server: IServer
): Promise<number> {
  if (server.ownerId.toString() === userId) {
    return ALL_PERMISSIONS;
  }

  const member = server.members.find((m) => m.userId.toString() === userId);
  if (!member) return 0;

  // Use the member's fixed role to get base permissions
  const basePerms = getRolePermissions(member.role);

  // Apply channel overrides if any (overrides target Role IDs; member has customRoleIds)
  if (channel.permissionOverrides && channel.permissionOverrides.length > 0) {
    const memberRoleIds = (member.customRoleIds || []).map((id) => id.toString());
    return computeMemberPermissions(
      member.role,
      channel.permissionOverrides.map((o) => ({
        roleId: o.roleId.toString(),
        allow: o.allow,
        deny: o.deny,
      })),
      memberRoleIds
    );
  }

  return basePerms;
}

export function hasChannelPermission(perms: number, perm: number): boolean {
  if (perms & Permissions.ADMINISTRATOR) return true;
  return (perms & perm) === perm;
}

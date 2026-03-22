export const Permissions = {
  ADMINISTRATOR: 1 << 0,   // 1
  MANAGE_SERVER: 1 << 1,   // 2
  MANAGE_CHANNELS: 1 << 2,   // 4
  MANAGE_ROLES: 1 << 3,   // 8
  KICK_MEMBERS: 1 << 4,   // 16
  BAN_MEMBERS: 1 << 5,   // 32
  MANAGE_MESSAGES: 1 << 6,   // 64
  SEND_MESSAGES: 1 << 7,   // 128
  READ_MESSAGES: 1 << 8,   // 256
  ATTACH_FILES: 1 << 9,   // 512
  ADD_REACTIONS: 1 << 10,  // 1024
  MUTE_MEMBERS: 1 << 11,  // 2048
  CONNECT_VOICE: 1 << 12,  // 4096
  SPEAK_VOICE: 1 << 13,  // 8192
  VIDEO_VOICE: 1 << 14,  // 16384
} as const;

export const ALL_PERMISSIONS = Object.values(Permissions).reduce((a, b) => a | b, 0);

// Admin: full permissions
export const ADMIN_PERMISSIONS = ALL_PERMISSIONS;

// Moderator: manage messages, kick, ban, mute + basic permissions
export const MODERATOR_PERMISSIONS =
  Permissions.MANAGE_MESSAGES |
  Permissions.KICK_MEMBERS |
  Permissions.BAN_MEMBERS |
  Permissions.MUTE_MEMBERS |
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGES |
  Permissions.ATTACH_FILES |
  Permissions.ADD_REACTIONS |
  Permissions.CONNECT_VOICE |
  Permissions.SPEAK_VOICE |
  Permissions.VIDEO_VOICE;

// Member: basic chat permissions
export const MEMBER_PERMISSIONS =
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGES |
  Permissions.ATTACH_FILES |
  Permissions.ADD_REACTIONS |
  Permissions.CONNECT_VOICE |
  Permissions.SPEAK_VOICE |
  Permissions.VIDEO_VOICE;

export type MemberRole = 'admin' | 'moderator' | 'member';

export function getRolePermissions(role: MemberRole): number {
  switch (role) {
    case 'admin': return ADMIN_PERMISSIONS;
    case 'moderator': return MODERATOR_PERMISSIONS;
    case 'member': return MEMBER_PERMISSIONS;
    default: return MEMBER_PERMISSIONS;
  }
}

export function hasPermission(userPerms: number, perm: number): boolean {
  if (userPerms & Permissions.ADMINISTRATOR) return true;
  return (userPerms & perm) === perm;
}

export function computeMemberPermissions(
  memberRole: MemberRole,
  channelOverrides?: { roleId: string; allow: number; deny: number }[],
  memberRoleIds?: string[]
): number {
  let perms = getRolePermissions(memberRole);

  if (perms & Permissions.ADMINISTRATOR) return ALL_PERMISSIONS;

  if (channelOverrides && memberRoleIds) {
    for (const override of channelOverrides) {
      if (memberRoleIds.includes(override.roleId)) {
        perms &= ~override.deny;
        perms |= override.allow;
      }
    }
  }

  return perms;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';

export type FriendRequestLevel = 'everyone' | 'friends_of_friends' | 'none';

export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  banner?: string;
  status: UserStatus;
  activityStatus: string;
  mutedServers?: string[];
  allowDMs?: boolean;
  allowFriendRequests?: FriendRequestLevel;
  notificationSound?: boolean;
  desktopNotifications?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ServerData {
  _id: string;
  name: string;
  description?: string;
  icon: string;
  banner?: string;
  ownerId: string;
  members: ServerMember[];
  categories: Category[];
  channels: Channel[];
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export type MemberRole = 'admin' | 'moderator' | 'member';

export interface ServerMember {
  userId: string;
  role: MemberRole;
  customRoleIds?: string[];
  isBooster: boolean;
  isVip: boolean;
  joinedAt: string;
  nickname: string;
  mutedUntil: string | null;
}

export interface Category {
  _id: string;
  name: string;
  serverId: string;
  position: number;
  channels: Channel[];
  createdAt: string;
}

export type ChannelType = 'text' | 'voice';

export interface Channel {
  _id: string;
  name: string;
  type: ChannelType;
  serverId: string;
  categoryId: string | null;
  topic: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'default' | 'reply' | 'system';

export interface Message {
  _id: string;
  content: string;
  authorId: User;
  channelId: string;
  serverId: string;
  type: MessageType;
  replyTo: { _id: string; content: string; authorId: string | User } | null;
  attachments: Attachment[];
  reactions: Reaction[];
  mentions?: string[];
  pinned: boolean;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file';
  name: string;
  size: number;
  spoiler?: boolean;
}

export interface Reaction {
  emoji: string;
  users: string[];
}

export type RoleType = 'admin' | 'moderator' | 'member';

export interface Role {
  _id: string;
  name: string;
  type: RoleType;
  color: string;
  permissions: number;
  position: number;
  serverId: string;
  isSystemRole: boolean;
  createdAt: string;
}

export interface BanEntry {
  _id: string;
  userId: User;
  serverId: string;
  bannedBy: User;
  reason: string;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  serverId: string;
  action: string;
  moderatorId: { _id: string; username: string; displayName: string };
  targetId: { _id: string; username: string; displayName: string };
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const Permissions = {
  ADMINISTRATOR: 1 << 0,
  MANAGE_SERVER: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  KICK_MEMBERS: 1 << 4,
  BAN_MEMBERS: 1 << 5,
  MANAGE_MESSAGES: 1 << 6,
  SEND_MESSAGES: 1 << 7,
  READ_MESSAGES: 1 << 8,
  ATTACH_FILES: 1 << 9,
  ADD_REACTIONS: 1 << 10,
  MUTE_MEMBERS: 1 << 11,
  CONNECT_VOICE: 1 << 12,
  SPEAK_VOICE: 1 << 13,
  VIDEO_VOICE: 1 << 14,
} as const;

export const PERMISSION_LABELS: Record<number, string> = {
  [Permissions.ADMINISTRATOR]: 'Administrator',
  [Permissions.MANAGE_SERVER]: 'Manage Server',
  [Permissions.MANAGE_CHANNELS]: 'Manage Channels',
  [Permissions.MANAGE_ROLES]: 'Manage Roles',
  [Permissions.KICK_MEMBERS]: 'Kick Members',
  [Permissions.BAN_MEMBERS]: 'Ban Members',
  [Permissions.MANAGE_MESSAGES]: 'Manage Messages',
  [Permissions.SEND_MESSAGES]: 'Send Messages',
  [Permissions.READ_MESSAGES]: 'Read Messages',
  [Permissions.ATTACH_FILES]: 'Attach Files',
  [Permissions.ADD_REACTIONS]: 'Add Reactions',
  [Permissions.MUTE_MEMBERS]: 'Mute Members',
  [Permissions.CONNECT_VOICE]: 'Connect to Voice',
  [Permissions.SPEAK_VOICE]: 'Speak in Voice',
  [Permissions.VIDEO_VOICE]: 'Use Video',
};

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: {
    _id: string;
    content: string;
    authorId: { displayName: string };
    createdAt: string;
    deleted: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  _id: string;
  conversationId: string;
  authorId: User;
  content: string;
  attachments: Attachment[];
  readBy?: string[];
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
}

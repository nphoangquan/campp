import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export type MemberRole = 'admin' | 'moderator' | 'member';

export interface IServerMember {
  userId: mongoose.Types.ObjectId;
  role: MemberRole;
  customRoleIds: mongoose.Types.ObjectId[];
  isBooster: boolean;
  isVip: boolean;
  joinedAt: Date;
  nickname: string;
  mutedUntil: Date | null;
}

export interface IServer extends Document {
  name: string;
  description?: string;
  icon: string;
  banner: string;
  ownerId: mongoose.Types.ObjectId;
  members: IServerMember[];
  categories: mongoose.Types.ObjectId[];
  channels: mongoose.Types.ObjectId[];
  roles: mongoose.Types.ObjectId[];
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const serverSchema = new Schema<IServer>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    icon: { type: String, default: '' },
    banner: { type: String, default: '' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'moderator', 'member'], default: 'member' },
        customRoleIds: { type: [Schema.Types.ObjectId], ref: 'Role', default: [] },
        isBooster: { type: Boolean, default: false },
        isVip: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now },
        nickname: { type: String, default: '' },
        mutedUntil: { type: Date, default: null },
      },
    ],
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    channels: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    inviteCode: {
      type: String, unique: true,
      default: () => crypto.randomBytes(4).toString('hex'),
    },
  },
  { timestamps: true }
);

serverSchema.index({ 'members.userId': 1 });

export const Server = mongoose.model<IServer>('Server', serverSchema);

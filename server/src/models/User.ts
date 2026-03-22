import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar: string;
  banner: string;
  status: UserStatus;
  invisibleMode: boolean;
  activityStatus: string;
  friends: mongoose.Types.ObjectId[];
  friendRequests: {
    incoming: mongoose.Types.ObjectId[];
    outgoing: mongoose.Types.ObjectId[];
  };
  servers: mongoose.Types.ObjectId[];
  mutedServers: mongoose.Types.ObjectId[];
  // Privacy settings
  allowDMs: boolean;
  allowFriendRequests: 'everyone' | 'friends_of_friends' | 'none';
  // Notification settings
  notificationSound: boolean;
  desktopNotifications: boolean;
  emailVerified: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 32 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 32 },
    avatar: { type: String, default: '' },
    banner: { type: String, default: '' },
    status: { type: String, enum: ['online', 'idle', 'dnd', 'offline', 'invisible'], default: 'offline' },
    invisibleMode: { type: Boolean, default: false },
    activityStatus: { type: String, default: '', maxlength: 128 },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: {
      incoming: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      outgoing: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    servers: [{ type: Schema.Types.ObjectId, ref: 'Server' }],
    mutedServers: { type: [Schema.Types.ObjectId], ref: 'Server', default: [] },
    // Privacy
    allowDMs: { type: Boolean, default: true },
    allowFriendRequests: { type: String, enum: ['everyone', 'friends_of_friends', 'none'], default: 'everyone' },
    // Notifications
    notificationSound: { type: Boolean, default: true },
    desktopNotifications: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (ret as any).passwordHash;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);

import mongoose, { Document, Schema } from 'mongoose';

export type ChannelType = 'text' | 'voice';

export interface IPermissionOverride {
  roleId: mongoose.Types.ObjectId;
  allow: number;
  deny: number;
}

export interface IChannel extends Document {
  name: string;
  type: ChannelType;
  serverId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId | null;
  topic: string;
  position: number;
  permissionOverrides: IPermissionOverride[];
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    topic: {
      type: String,
      default: '',
      maxlength: 1024,
    },
    position: {
      type: Number,
      default: 0,
    },
    permissionOverrides: [
      {
        roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
        allow: { type: Number, default: 0 },
        deny: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

channelSchema.index({ serverId: 1, position: 1 });

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);

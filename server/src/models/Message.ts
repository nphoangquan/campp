import mongoose, { Document, Schema } from 'mongoose';

export type MessageType = 'default' | 'reply' | 'system';

export interface IAttachment {
  url: string;
  type: 'image' | 'video' | 'file';
  name: string;
  size: number;
  spoiler?: boolean;
}

export interface IReaction {
  emoji: string;
  users: mongoose.Types.ObjectId[];
}

export interface IMessage extends Document {
  content: string;
  authorId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  serverId: mongoose.Types.ObjectId;
  type: MessageType;
  replyTo: mongoose.Types.ObjectId | null;
  attachments: IAttachment[];
  reactions: IReaction[];
  mentions: mongoose.Types.ObjectId[];
  pinned: boolean;
  editedAt: Date | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    content: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
    },
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    type: {
      type: String,
      enum: ['default', 'reply', 'system'],
      default: 'default',
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    attachments: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video', 'file'], required: true },
        name: { type: String, required: true },
        size: { type: Number, required: true },
        spoiler: { type: Boolean, default: false },
      },
    ],
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pinned: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ channelId: 1, _id: -1 });
messageSchema.index({ channelId: 1, deleted: 1, createdAt: -1 });
messageSchema.index({ serverId: 1 });
messageSchema.index({ channelId: 1, pinned: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);

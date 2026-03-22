import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'mention' | 'everyone' | 'here' | 'dm';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  messageId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  serverId?: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['mention', 'everyone', 'here', 'dm'], required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', default: null },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

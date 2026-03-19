import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'DirectMessage',
      default: null,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

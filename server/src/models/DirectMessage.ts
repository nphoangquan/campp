import mongoose, { Document, Schema } from 'mongoose';

export interface IDirectMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  attachments: {
    url: string;
    type: 'image' | 'video' | 'file';
    name: string;
    size: number;
  }[];
  readBy: mongoose.Types.ObjectId[];
  editedAt: Date | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const directMessageSchema = new Schema<IDirectMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    attachments: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video', 'file'], required: true },
        name: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

directMessageSchema.index({ conversationId: 1, createdAt: -1 });
directMessageSchema.index({ conversationId: 1, _id: -1 });

export const DirectMessage = mongoose.model<IDirectMessage>('DirectMessage', directMessageSchema);

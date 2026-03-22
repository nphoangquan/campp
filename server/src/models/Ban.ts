import mongoose, { Document, Schema } from 'mongoose';

export interface IBan extends Document {
  userId: mongoose.Types.ObjectId;
  serverId: mongoose.Types.ObjectId;
  bannedBy: mongoose.Types.ObjectId;
  reason: string;
  createdAt: Date;
}

const banSchema = new Schema<IBan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 512,
    },
  },
  { timestamps: true }
);

banSchema.index({ serverId: 1, userId: 1 }, { unique: true });

export const Ban = mongoose.model<IBan>('Ban', banSchema);

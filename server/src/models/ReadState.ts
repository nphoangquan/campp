import mongoose, { Document, Schema } from 'mongoose';

export interface IReadState extends Document {
  userId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  lastReadAt: Date;
  updatedAt: Date;
}

const readStateSchema = new Schema<IReadState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

readStateSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const ReadState = mongoose.model<IReadState>('ReadState', readStateSchema);

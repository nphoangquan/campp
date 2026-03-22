import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  serverId: mongoose.Types.ObjectId;
  position: number;
  channels: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    channels: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
  },
  { timestamps: true }
);

categorySchema.index({ serverId: 1, position: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);

import mongoose, { Document, Schema } from 'mongoose';

export type RoleType = 'admin' | 'moderator' | 'member';

export interface IRole extends Document {
  name: string;
  type: RoleType;
  color: string;
  permissions: number;
  position: number;
  serverId: mongoose.Types.ObjectId;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ['admin', 'moderator', 'member'], required: true },
    color: { type: String, default: '#99AAB5' },
    permissions: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    isSystemRole: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roleSchema.index({ serverId: 1, position: 1 });

export const Role = mongoose.model<IRole>('Role', roleSchema);

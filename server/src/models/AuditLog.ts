import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'MEMBER_KICK'
  | 'MEMBER_BAN'
  | 'MEMBER_UNBAN'
  | 'MEMBER_MUTE'
  | 'MEMBER_UNMUTE'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'ROLE_DELETE'
  | 'ROLE_ASSIGN'
  | 'ROLE_REMOVE';

export interface IAuditLog extends Document {
  serverId: mongoose.Types.ObjectId;
  action: AuditAction;
  moderatorId: mongoose.Types.ObjectId;
  targetId?: mongoose.Types.ObjectId;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    moderatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 512,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ serverId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

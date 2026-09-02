import { Schema, model, Document, Types } from 'mongoose';

export const AUDIT_ACTIONS = [
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'SUBSCRIPTION_CHANGED',
  'PAYMENT_MANUALLY_VALIDATED',
  'LESSON_CREATED',
  'LESSON_PUBLISHED',
  'LESSON_ARCHIVED',
  'IMPORT_CONFIRMED',
  'LEVEL_CHANGED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog {
  actorId: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant de l’auteur de l’action est obligatoire'],
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Le type d’entité ciblée est obligatoire'],
      trim: true,
      index: true,
    },
    entityId: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.actorId = ret.actorId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel = model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema
);

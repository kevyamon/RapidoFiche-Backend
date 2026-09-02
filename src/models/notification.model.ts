import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'SUBSCRIPTION_EXPIRING'
  | 'PAYMENT_CONFIRMED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'CONTENT_ADDED'
  | 'SYSTEM_ALERT';

export interface INotification {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant utilisateur est obligatoire'],
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'SUBSCRIPTION_EXPIRING',
        'PAYMENT_CONFIRMED',
        'SUBSCRIPTION_ACTIVATED',
        'SUBSCRIPTION_EXPIRED',
        'CONTENT_ADDED',
        'SYSTEM_ALERT',
      ],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Le titre de la notification est obligatoire'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Le message est obligatoire'],
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    readAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = model<INotificationDocument>(
  'Notification',
  notificationSchema
);

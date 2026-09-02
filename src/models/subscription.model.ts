import { Schema, model, Document, Types } from 'mongoose';

export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ISubscription {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
  paymentId?: Types.ObjectId;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionDocument extends ISubscription, Document {
  isCurrentlyActive(): boolean;
}

const subscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant utilisateur est obligatoire'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'L’identifiant du plan est obligatoire'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = (obj._id as { toString(): string })?.toString();
        if (obj.userId) obj.userId = (obj.userId as { toString(): string }).toString();
        if (obj.planId) obj.planId = (obj.planId as { toString(): string }).toString();
        if (obj.paymentId) obj.paymentId = (obj.paymentId as { toString(): string }).toString();
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

subscriptionSchema.methods.isCurrentlyActive = function (): boolean {
  if (this.status !== 'ACTIVE') {
    return false;
  }
  if (!this.endDate) {
    return false;
  }
  return new Date() <= new Date(this.endDate);
};

export const SubscriptionModel = model<ISubscriptionDocument>(
  'Subscription',
  subscriptionSchema
);

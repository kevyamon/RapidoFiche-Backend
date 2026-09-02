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
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString();
        ret.planId = ret.planId?.toString();
        ret.paymentId = ret.paymentId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
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

import { Schema, model, Document, Types } from 'mongoose';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface IPayment {
  userId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  reference: string;
  amount: number;
  currency: 'XOF';
  provider: 'geniuspay' | 'mock';
  providerTransactionId?: string;
  status: PaymentStatus;
  paymentMethod?: string;
  rawCallbackPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDocument extends IPayment, Document {}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant utilisateur est obligatoire'],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    reference: {
      type: String,
      required: [true, 'La référence de paiement est obligatoire'],
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Le montant est obligatoire'],
      min: [200, 'Le montant minimum est de 200 FCFA'],
    },
    currency: {
      type: String,
      required: true,
      default: 'XOF',
      enum: ['XOF'],
    },
    provider: {
      type: String,
      required: true,
      enum: ['geniuspay', 'mock'],
      default: 'mock',
    },
    providerTransactionId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    rawCallbackPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString();
        ret.subscriptionId = ret.subscriptionId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ provider: 1, providerTransactionId: 1 });

export const PaymentModel = model<IPaymentDocument>('Payment', paymentSchema);

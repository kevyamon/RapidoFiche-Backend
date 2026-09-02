import { Schema, model, Document } from 'mongoose';

export interface ISubscriptionPlan {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: 'XOF';
  intervalMonths: number;
  features: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionPlanDocument extends ISubscriptionPlan, Document {}

const subscriptionPlanSchema = new Schema<ISubscriptionPlanDocument>(
  {
    code: {
      type: String,
      required: [true, 'Le code du plan est obligatoire'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom du plan est obligatoire'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Le montant du plan est obligatoire'],
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'XOF',
      enum: ['XOF'],
    },
    intervalMonths: {
      type: Number,
      required: true,
      default: 1,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = (obj._id as { toString(): string })?.toString();
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

export const SubscriptionPlanModel = model<ISubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

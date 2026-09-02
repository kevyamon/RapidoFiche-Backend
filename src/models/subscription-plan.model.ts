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
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const SubscriptionPlanModel = model<ISubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

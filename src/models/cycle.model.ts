import { Schema, model, Document } from 'mongoose';

export type CycleName = 'PRESCHOOL' | 'PRIMARY';

export interface ICycle {
  name: CycleName;
  label: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICycleDocument extends ICycle, Document {}

const cycleSchema = new Schema<ICycleDocument>(
  {
    name: {
      type: String,
      required: [true, 'Le nom du cycle est obligatoire'],
      enum: ['PRESCHOOL', 'PRIMARY'],
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Le libellé du cycle est obligatoire'],
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
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

cycleSchema.index({ active: 1, order: 1 });

export const CycleModel = model<ICycleDocument>('Cycle', cycleSchema);

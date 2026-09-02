import { Schema, model, Document, Types } from 'mongoose';

export const EDUCATION_LEVEL_CODES = [
  'PS',
  'MS',
  'GS',
  'CP1',
  'CP2',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
] as const;

export type EducationLevelCode = (typeof EDUCATION_LEVEL_CODES)[number];

export interface IEducationLevel {
  cycleId: Types.ObjectId;
  code: EducationLevelCode;
  label: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEducationLevelDocument extends IEducationLevel, Document {}

const educationLevelSchema = new Schema<IEducationLevelDocument>(
  {
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: 'Cycle',
      required: [true, 'Le cycle de rattachement est obligatoire'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Le code du niveau est obligatoire'],
      enum: EDUCATION_LEVEL_CODES,
      unique: true,
      trim: true,
      uppercase: true,
    },
    label: {
      type: String,
      required: [true, 'Le libellé du niveau est obligatoire'],
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
        if (obj.cycleId) {
          obj.cycleId = (obj.cycleId as { toString(): string }).toString();
        }
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

educationLevelSchema.index({ active: 1, order: 1 });
educationLevelSchema.index({ cycleId: 1, active: 1 });

export const EducationLevelModel = model<IEducationLevelDocument>(
  'EducationLevel',
  educationLevelSchema
);

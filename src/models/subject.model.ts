import { Schema, model, Document, Types } from 'mongoose';

export interface ISubject {
  name: string;
  slug: string;
  levelIds: Types.ObjectId[];
  icon?: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubjectDocument extends ISubject, Document {}

const subjectSchema = new Schema<ISubjectDocument>(
  {
    name: {
      type: String,
      required: [true, 'Le nom de la matière est obligatoire'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Le slug de la matière est obligatoire'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    levelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'EducationLevel',
        required: true,
      },
    ],
    icon: {
      type: String,
      trim: true,
      default: 'book-open',
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
        if (Array.isArray(obj.levelIds)) {
          obj.levelIds = obj.levelIds.map((id: { toString(): string }) => id.toString());
        }
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

subjectSchema.index({ levelIds: 1, active: 1 });
subjectSchema.index({ active: 1, order: 1 });

export const SubjectModel = model<ISubjectDocument>('Subject', subjectSchema);

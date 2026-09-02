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
        ret.id = ret._id.toString();
        ret.levelIds = ret.levelIds?.map((id: Types.ObjectId) => id.toString());
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

subjectSchema.index({ levelIds: 1, active: 1 });
subjectSchema.index({ active: 1, order: 1 });

export const SubjectModel = model<ISubjectDocument>('Subject', subjectSchema);

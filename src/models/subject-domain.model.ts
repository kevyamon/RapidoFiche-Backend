import { Schema, model, Document, Types } from 'mongoose';

export interface ISubjectDomain {
  subjectId: Types.ObjectId;
  levelIds?: Types.ObjectId[];
  name: string;
  slug: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubjectDomainDocument extends ISubjectDomain, Document {}

const subjectDomainSchema = new Schema<ISubjectDomainDocument>(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'La matière parente est obligatoire'],
      index: true,
    },
    levelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'EducationLevel',
      },
    ],
    name: {
      type: String,
      required: [true, 'Le nom du domaine est obligatoire'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Le slug du domaine est obligatoire'],
      trim: true,
      lowercase: true,
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
        if (obj.subjectId) {
          obj.subjectId = (obj.subjectId as { toString(): string }).toString();
        }
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

subjectDomainSchema.index({ subjectId: 1, slug: 1 }, { unique: true });
subjectDomainSchema.index({ subjectId: 1, active: 1, order: 1 });

export const SubjectDomainModel = model<ISubjectDomainDocument>(
  'SubjectDomain',
  subjectDomainSchema
);

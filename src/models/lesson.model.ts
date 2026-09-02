import { Schema, model, Document, Types } from 'mongoose';

export type LessonType =
  | 'PEDAGOGICAL_SHEET'
  | 'EXERCISE'
  | 'ASSESSMENT'
  | 'GUIDE'
  | 'RESOURCE'
  | 'OTHER';

export type LessonSourceType =
  | 'OWNED'
  | 'LICENSED'
  | 'OFFICIAL'
  | 'PARTNER'
  | 'OTHER';

export type LessonRightsStatus = 'VERIFIED' | 'PENDING' | 'RESTRICTED';

export type LessonStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface ILesson {
  title: string;
  slug?: string;
  levelId: Types.ObjectId;
  subjectId: Types.ObjectId;
  domainId?: Types.ObjectId;
  term?: number;
  week?: number;
  periodLabel?: string;
  topic?: string;
  lessonType: LessonType;
  schoolYear?: string;
  description?: string;
  fileAssetId: Types.ObjectId;
  thumbnailAssetId?: Types.ObjectId;
  sourceType: LessonSourceType;
  rightsStatus: LessonRightsStatus;
  status: LessonStatus;
  order: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILessonDocument extends ILesson, Document {}

const lessonSchema = new Schema<ILessonDocument>(
  {
    title: {
      type: String,
      required: [true, 'Le titre de la fiche est obligatoire'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    levelId: {
      type: Schema.Types.ObjectId,
      ref: 'EducationLevel',
      required: [true, 'Le niveau pédagogique est obligatoire'],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'La matière est obligatoire'],
      index: true,
    },
    domainId: {
      type: Schema.Types.ObjectId,
      ref: 'SubjectDomain',
      index: true,
    },
    term: {
      type: Number,
      min: 1,
      max: 4,
    },
    week: {
      type: Number,
      min: 1,
      max: 52,
      index: true,
    },
    periodLabel: {
      type: String,
      trim: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    lessonType: {
      type: String,
      required: true,
      enum: [
        'PEDAGOGICAL_SHEET',
        'EXERCISE',
        'ASSESSMENT',
        'GUIDE',
        'RESOURCE',
        'OTHER',
      ],
      default: 'PEDAGOGICAL_SHEET',
      index: true,
    },
    schoolYear: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fileAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'L’asset PDF associé est obligatoire'],
    },
    thumbnailAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
    },
    sourceType: {
      type: String,
      enum: ['OWNED', 'LICENSED', 'OFFICIAL', 'PARTNER', 'OTHER'],
      default: 'OFFICIAL',
    },
    rightsStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'RESTRICTED'],
      default: 'VERIFIED',
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.levelId = ret.levelId?.toString();
        ret.subjectId = ret.subjectId?.toString();
        ret.domainId = ret.domainId?.toString();
        ret.fileAssetId = ret.fileAssetId?.toString();
        ret.thumbnailAssetId = ret.thumbnailAssetId?.toString();
        ret.createdBy = ret.createdBy?.toString();
        ret.updatedBy = ret.updatedBy?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

lessonSchema.index({ levelId: 1, subjectId: 1, status: 1 });
lessonSchema.index({ levelId: 1, week: 1, status: 1 });
lessonSchema.index({ title: 'text', topic: 'text', description: 'text' });

export const LessonModel = model<ILessonDocument>('Lesson', lessonSchema);

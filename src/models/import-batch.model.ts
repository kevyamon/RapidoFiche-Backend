import { Schema, model, Document, Types } from 'mongoose';

export type ImportBatchStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'REVIEW_REQUIRED'
  | 'COMPLETED'
  | 'FAILED';

export type BatchItemStatus = 'PARSED' | 'ERROR' | 'IMPORTED';

export interface IBatchParsedData {
  levelCode?: string;
  levelId?: Types.ObjectId;
  subjectName?: string;
  subjectId?: Types.ObjectId;
  domainId?: Types.ObjectId;
  week?: number;
  topic?: string;
  title?: string;
}

export interface IBatchItem {
  fileName: string;
  originalName: string;
  status: BatchItemStatus;
  parsedData?: IBatchParsedData;
  errorMessage?: string;
  lessonId?: Types.ObjectId;
  assetId?: Types.ObjectId;
}

export interface IImportBatch {
  createdBy: Types.ObjectId;
  status: ImportBatchStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  files: IBatchItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IImportBatchDocument extends IImportBatch, Document {}

const batchItemSchema = new Schema<IBatchItem>(
  {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    status: {
      type: String,
      enum: ['PARSED', 'ERROR', 'IMPORTED'],
      default: 'PARSED',
    },
    parsedData: {
      levelCode: String,
      levelId: { type: Schema.Types.ObjectId, ref: 'EducationLevel' },
      subjectName: String,
      subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
      domainId: { type: Schema.Types.ObjectId, ref: 'SubjectDomain' },
      week: Number,
      topic: String,
      title: String,
    },
    errorMessage: String,
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
  },
  { _id: false }
);

const importBatchSchema = new Schema<IImportBatchDocument>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant du créateur est obligatoire'],
      index: true,
    },
    status: {
      type: String,
      enum: [
        'UPLOADING',
        'PROCESSING',
        'REVIEW_REQUIRED',
        'COMPLETED',
        'FAILED',
      ],
      default: 'UPLOADING',
      index: true,
    },
    totalFiles: { type: Number, default: 0 },
    processedFiles: { type: Number, default: 0 },
    failedFiles: { type: Number, default: 0 },
    files: [batchItemSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.createdBy = ret.createdBy?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

importBatchSchema.index({ createdBy: 1, createdAt: -1 });

export const ImportBatchModel = model<IImportBatchDocument>(
  'ImportBatch',
  importBatchSchema
);

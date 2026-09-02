import { Schema, model, Document, Types } from 'mongoose';

export interface ILessonHistory {
  userId: Types.ObjectId;
  lessonId: Types.ObjectId;
  lastViewedAt: Date;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILessonHistoryDocument extends ILessonHistory, Document {}

const lessonHistorySchema = new Schema<ILessonHistoryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L’identifiant utilisateur est obligatoire'],
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'L’identifiant de la fiche est obligatoire'],
      index: true,
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = (obj._id as { toString(): string })?.toString();
        if (obj.userId) obj.userId = (obj.userId as { toString(): string }).toString();
        if (obj.lessonId) obj.lessonId = (obj.lessonId as { toString(): string }).toString();
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  }
);

lessonHistorySchema.index({ userId: 1, lessonId: 1 }, { unique: true });
lessonHistorySchema.index({ userId: 1, lastViewedAt: -1 });

export const LessonHistoryModel = model<ILessonHistoryDocument>(
  'LessonHistory',
  lessonHistorySchema
);

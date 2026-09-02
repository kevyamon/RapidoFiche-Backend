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
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString();
        ret.lessonId = ret.lessonId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
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

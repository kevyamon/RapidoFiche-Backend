import { Schema, model, Document, Types } from 'mongoose';

export interface IFavorite {
  userId: Types.ObjectId;
  lessonId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFavoriteDocument extends IFavorite, Document {}

const favoriteSchema = new Schema<IFavoriteDocument>(
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

favoriteSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });

export const FavoriteModel = model<IFavoriteDocument>(
  'Favorite',
  favoriteSchema
);

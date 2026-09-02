import { Types } from 'mongoose';
import { FavoriteModel } from '../models/favorite.model';
import { LessonHistoryModel } from '../models/lesson-history.model';
import { LessonModel } from '../models/lesson.model';
import { PaginationMeta } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class FavoriteHistoryService {
  public static async getFavorites(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ favorites: unknown[]; pagination: PaginationMeta }> {
    const filter = { userId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      FavoriteModel.find(filter)
        .populate({
          path: 'lessonId',
          populate: [
            { path: 'levelId', select: 'code label' },
            { path: 'subjectId', select: 'name icon' },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FavoriteModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      favorites,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public static async addFavorite(userId: string, lessonId: string): Promise<void> {
    const lesson = await LessonModel.findById(lessonId).lean();
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
    }

    await FavoriteModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          lessonId: new Types.ObjectId(lessonId),
        },
      },
      { upsert: true }
    );
  }

  public static async removeFavorite(userId: string, lessonId: string): Promise<void> {
    await FavoriteModel.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
    });
  }

  public static async isFavorite(userId: string, lessonId: string): Promise<boolean> {
    const fav = await FavoriteModel.exists({
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
    });
    return !!fav;
  }

  public static async getHistory(userId: string, limit = 20): Promise<unknown[]> {
    return LessonHistoryModel.find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'lessonId',
        populate: [
          { path: 'levelId', select: 'code label' },
          { path: 'subjectId', select: 'name icon' },
        ],
      })
      .sort({ lastViewedAt: -1 })
      .limit(limit)
      .lean();
  }

  public static async recordView(userId: string, lessonId: string): Promise<void> {
    await LessonHistoryModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      },
      {
        $set: { lastViewedAt: new Date() },
        $inc: { viewCount: 1 },
      },
      { upsert: true }
    );
  }
}

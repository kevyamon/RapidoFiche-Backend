import { Types } from 'mongoose';
import { LessonModel, ILessonDocument } from '../models/lesson.model';
import { QueryLessonsInput } from '../schemas/lesson.schema';
import { ContentAccessService } from './content-access.service';
import { FavoriteHistoryService } from './favorite-history.service';
import { generateLessonAccessToken } from '../utils/token.utils';
import { ROLES, UserRole } from '../constants/roles.constants';
import { PaginationMeta } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export interface LessonAccessInfo {
  lessonId: string;
  viewerUrl: string;
  expiresAt: string;
  offlineAllowed: boolean;
}

export class LessonService {
  public static async getLessons(
    query: QueryLessonsInput,
    userRole?: UserRole,
    userPrimaryLevelId?: string
  ): Promise<{ lessons: ILessonDocument[]; pagination: PaginationMeta }> {
    const filter: Record<string, unknown> = {};

    // 1. Visibilité : seules les fiches publiées sont visibles pour les enseignants
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.CONTENT_MANAGER) {
      filter.status = 'PUBLISHED';
    }

    // 2. Par défaut, un enseignant consulte les fiches de sa classe principale (CDC Section 31)
    if (query.levelId) {
      filter.levelId = new Types.ObjectId(query.levelId);
    } else if (userPrimaryLevelId && userRole === ROLES.TEACHER) {
      filter.levelId = new Types.ObjectId(userPrimaryLevelId);
    }

    if (query.subjectId) {
      filter.subjectId = new Types.ObjectId(query.subjectId);
    }
    if (query.domainId) {
      filter.domainId = new Types.ObjectId(query.domainId);
    }
    if (query.week) {
      filter.week = query.week;
    }
    if (query.term) {
      filter.term = query.term;
    }
    if (query.schoolYear) {
      filter.schoolYear = query.schoolYear;
    }
    if (query.lessonType) {
      filter.lessonType = query.lessonType;
    }
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [lessons, total] = await Promise.all([
      LessonModel.find(filter)
        .populate('levelId', 'code label')
        .populate('subjectId', 'name icon')
        .populate('domainId', 'name')
        .sort({ week: 1, order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LessonModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      lessons: lessons as unknown as ILessonDocument[],
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

  public static async getLessonById(
    lessonId: string,
    userRole?: UserRole
  ): Promise<ILessonDocument> {
    const lesson = await LessonModel.findById(lessonId)
      .populate('levelId', 'code label')
      .populate('subjectId', 'name icon')
      .populate('domainId', 'name')
      .lean();

    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche pédagogique introuvable', 404);
    }

    if (
      lesson.status !== 'PUBLISHED' &&
      userRole !== ROLES.ADMIN &&
      userRole !== ROLES.CONTENT_MANAGER
    ) {
      throw new AppError(ERROR_CODES.LESSON_NOT_AVAILABLE, 'Fiche non disponible', 403);
    }

    return lesson as unknown as ILessonDocument;
  }

  public static async requestLessonAccess(
    lessonId: string,
    userId: string,
    userRole: UserRole
  ): Promise<LessonAccessInfo> {
    const { lesson } = await ContentAccessService.assertCanAccessLesson(
      userId,
      userRole,
      lessonId
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const token = generateLessonAccessToken({
      userId,
      lessonId: lesson.id,
      levelId: lesson.levelId.toString(),
    });

    // Enregistrement automatique dans l'historique sans bloquer la réponse
    FavoriteHistoryService.recordView(userId, lessonId).catch(() => {});

    return {
      lessonId: lesson.id,
      viewerUrl: `/api/v1/lessons/${lesson.id}/stream?token=${token}`,
      expiresAt,
      offlineAllowed: true,
    };
  }
}

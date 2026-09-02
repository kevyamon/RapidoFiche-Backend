import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { ContentAccessService } from '../src/services/content-access.service';
import { LessonModel } from '../src/models/lesson.model';
import { UserModel } from '../src/models/user.model';
import { SubscriptionModel } from '../src/models/subscription.model';
import { ROLES } from '../src/constants/roles.constants';
import { AppError } from '../src/utils/app-error.utils';
import { ERROR_CODES } from '../src/constants/errors.constants';

describe('Tests de Contrôle d’Accès Mode Forteresse (CDC Section 141)', () => {
  const teacherId = new Types.ObjectId().toString();
  const adminId = new Types.ObjectId().toString();

  const cm2LevelId = new Types.ObjectId().toString();
  const ce1LevelId = new Types.ObjectId().toString();

  const cm2LessonId = new Types.ObjectId().toString();
  const ce1LessonId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Scénario 1 : Teacher CM2 + Abonnement ACTIF + Fiche CM2 -> ALLOWED', async () => {
    vi.spyOn(LessonModel, 'findById').mockResolvedValue({
      id: cm2LessonId,
      levelId: new Types.ObjectId(cm2LevelId),
      status: 'PUBLISHED',
    } as any);

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(teacherId),
        role: ROLES.TEACHER,
        primaryLevelId: new Types.ObjectId(cm2LevelId),
        status: 'ACTIVE',
      }),
    } as any);

    vi.spyOn(ContentAccessService, 'hasActiveSubscription').mockResolvedValue({
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000),
    } as any);

    const result = await ContentAccessService.assertCanAccessLesson(
      teacherId,
      ROLES.TEACHER,
      cm2LessonId
    );

    expect(result.allowed).toBe(true);
    expect(result.lesson).toBeDefined();
  });

  it('Scénario 2 : Teacher CM2 + Abonnement ACTIF + Fiche CE1 -> DENIED (LEVEL_ACCESS_DENIED)', async () => {
    vi.spyOn(LessonModel, 'findById').mockResolvedValue({
      id: ce1LessonId,
      levelId: new Types.ObjectId(ce1LevelId),
      status: 'PUBLISHED',
    } as any);

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(teacherId),
        role: ROLES.TEACHER,
        primaryLevelId: new Types.ObjectId(cm2LevelId), // CM2 !== CE1
        status: 'ACTIVE',
      }),
    } as any);

    vi.spyOn(ContentAccessService, 'hasActiveSubscription').mockResolvedValue({
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000),
    } as any);

    await expect(
      ContentAccessService.assertCanAccessLesson(teacherId, ROLES.TEACHER, ce1LessonId)
    ).rejects.toThrow(AppError);

    try {
      await ContentAccessService.assertCanAccessLesson(teacherId, ROLES.TEACHER, ce1LessonId);
    } catch (err: unknown) {
      const appErr = err as AppError;
      expect(appErr.code).toBe(ERROR_CODES.LEVEL_ACCESS_DENIED);
      expect(appErr.statusCode).toBe(403);
    }
  });

  it('Scénario 3 : Teacher CM2 + Abonnement EXPIRÉ + Fiche CM2 -> DENIED (SUBSCRIPTION_EXPIRED)', async () => {
    vi.spyOn(LessonModel, 'findById').mockResolvedValue({
      id: cm2LessonId,
      levelId: new Types.ObjectId(cm2LevelId),
      status: 'PUBLISHED',
    } as any);

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(teacherId),
        role: ROLES.TEACHER,
        primaryLevelId: new Types.ObjectId(cm2LevelId),
        status: 'ACTIVE',
      }),
    } as any);

    // Pas d'abonnement actif
    vi.spyOn(ContentAccessService, 'hasActiveSubscription').mockResolvedValue(null);

    vi.spyOn(SubscriptionModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          status: 'EXPIRED',
        }),
      }),
    } as any);

    await expect(
      ContentAccessService.assertCanAccessLesson(teacherId, ROLES.TEACHER, cm2LessonId)
    ).rejects.toThrow(AppError);

    try {
      await ContentAccessService.assertCanAccessLesson(teacherId, ROLES.TEACHER, cm2LessonId);
    } catch (err: unknown) {
      const appErr = err as AppError;
      expect(appErr.code).toBe(ERROR_CODES.SUBSCRIPTION_EXPIRED);
      expect(appErr.statusCode).toBe(403);
    }
  });

  it('Scénario 4 : Administrateur -> ALLOWED pour toutes les fiches', async () => {
    vi.spyOn(LessonModel, 'findById').mockResolvedValue({
      id: ce1LessonId,
      levelId: new Types.ObjectId(ce1LevelId),
      status: 'DRAFT', // Même en statut DRAFT
    } as any);

    const result = await ContentAccessService.assertCanAccessLesson(
      adminId,
      ROLES.ADMIN,
      ce1LessonId
    );

    expect(result.allowed).toBe(true);
  });
});

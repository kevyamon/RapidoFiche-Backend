import { Types } from 'mongoose';
import { UserModel } from '../models/user.model';
import { SubscriptionModel, ISubscriptionDocument } from '../models/subscription.model';
import { LessonModel, ILessonDocument } from '../models/lesson.model';
import { ROLES, UserRole } from '../constants/roles.constants';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export interface ContentAccessResult {
  allowed: boolean;
  lesson: ILessonDocument;
  subscription?: ISubscriptionDocument;
}

export class ContentAccessService {
  public static async hasActiveSubscription(
    userId: string
  ): Promise<ISubscriptionDocument | null> {
    const activeSub = await SubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'ACTIVE',
      endDate: { $gte: new Date() },
    }).lean();

    return activeSub as unknown as ISubscriptionDocument | null;
  }

  public static async canAccessLevel(
    userId: string,
    userRole: UserRole,
    userLevelId: string | undefined,
    targetLevelId: string
  ): Promise<boolean> {
    if (userRole === ROLES.ADMIN || userRole === ROLES.CONTENT_MANAGER) {
      return true;
    }

    if (!userLevelId) {
      return false;
    }

    return userLevelId.toString() === targetLevelId.toString();
  }

  public static async assertCanAccessLesson(
    userId: string,
    userRole: UserRole,
    lessonId: string
  ): Promise<ContentAccessResult> {
    // 1. Récupération de la fiche
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche pédagogique introuvable', 404);
    }

    // 2. Les administrateurs et gestionnaires de contenu ont un accès total
    if (userRole === ROLES.ADMIN || userRole === ROLES.CONTENT_MANAGER) {
      return { allowed: true, lesson };
    }

    // 3. Statut de publication
    if (lesson.status !== 'PUBLISHED') {
      throw new AppError(
        ERROR_CODES.LESSON_NOT_AVAILABLE,
        'Cette fiche n’est pas encore disponible à la consultation',
        403
      );
    }

    // 4. Vérification du compte utilisateur
    const user = await UserModel.findById(userId).lean();
    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Compte enseignant non autorisé');
    }

    // 5. Vérification de l'abonnement actif (Source de vérité serveur)
    const activeSub = await this.hasActiveSubscription(userId);
    if (!activeSub) {
      const anySub = await SubscriptionModel.findOne({
        userId: new Types.ObjectId(userId),
      })
        .sort({ createdAt: -1 })
        .lean();

      if (anySub && anySub.status === 'EXPIRED') {
        throw AppError.subscriptionExpired();
      }

      throw AppError.subscriptionRequired();
    }

    // 6. Vérification du niveau principal de l'enseignant (Règle d'abonnement au niveau MVP)
    const userLevelId = user.primaryLevelId?.toString();
    const lessonLevelId = lesson.levelId.toString();

    if (userLevelId !== lessonLevelId) {
      throw AppError.levelAccessDenied();
    }

    return {
      allowed: true,
      lesson,
      subscription: activeSub,
    };
  }
}

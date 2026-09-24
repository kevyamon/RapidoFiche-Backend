import { Types } from 'mongoose';
import { UserModel, IUserDocument } from '../models/user.model';
import { EducationLevelModel } from '../models/education-level.model';
import { AuditService } from './audit.service';
import { PaginationMeta } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { ROLES, UserRole } from '../constants/roles.constants';

export interface QueryUsersInput {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  levelId?: string;
}

export class AdminUserService {
  public static async getUsers(
    query: QueryUsersInput,
    requesterRole?: UserRole
  ): Promise<{ users: IUserDocument[]; pagination: PaginationMeta }> {
    const filter: Record<string, unknown> = {};

    // Si le demandeur n'est pas SUPER_ADMIN, il ne peut absolument pas voir les Superadmins
    if (requesterRole !== ROLES.SUPER_ADMIN) {
      filter.role = query.role && query.role !== ROLES.SUPER_ADMIN
        ? query.role
        : { $ne: ROLES.SUPER_ADMIN };
    } else if (query.role) {
      filter.role = query.role;
    }

    if (query.status) {
      filter.status = query.status;
    }
    if (query.levelId) {
      filter.primaryLevelId = new Types.ObjectId(query.levelId);
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { phone: regex }];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .populate('primaryLevelId', 'code label')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const normalizedUsers = users.map((u: any) => ({
      ...u,
      id: u._id?.toString() || u.id,
    }));

    return {
      users: normalizedUsers as unknown as IUserDocument[],
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

  public static async getUserById(
    userId: string,
    requesterRole?: UserRole
  ): Promise<IUserDocument> {
    const user = await UserModel.findById(userId)
      .populate('primaryLevelId', 'code label')
      .lean();

    if (!user) {
      throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND, 'Utilisateur introuvable', 404);
    }

    // Leurre : si le compte est SUPER_ADMIN et que le demandeur ne l'est pas, renvoyer 404
    if (user.role === ROLES.SUPER_ADMIN && requesterRole !== ROLES.SUPER_ADMIN) {
      throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND, 'Utilisateur introuvable', 404);
    }

    return {
      ...user,
      id: (user as any)._id?.toString() || (user as any).id,
    } as unknown as IUserDocument;
  }

  public static async suspendUser(
    adminId: string,
    userId: string,
    requesterRole?: UserRole,
    reason?: string
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND, 'Utilisateur introuvable', 404);
    }

    // Protection forteresse : seul le SUPER_ADMIN peut agir sur un admin ou un superadmin
    if (user.role === ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Impossible de modifier le compte du Super-Administrateur',
        403
      );
    }

    if (user.role === ROLES.ADMIN && requesterRole !== ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Seul le Super-Administrateur peut suspendre un administrateur',
        403
      );
    }

    user.status = 'SUSPENDED';
    await user.save();

    await AuditService.logAction(adminId, 'USER_SUSPENDED', 'User', userId, {
      targetRole: user.role,
      reason: reason || 'Suspension administrative',
    });
  }

  public static async reactivateUser(
    adminId: string,
    userId: string,
    requesterRole?: UserRole
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND, 'Utilisateur introuvable', 404);
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Action non autorisée sur ce compte',
        403
      );
    }

    if (user.role === ROLES.ADMIN && requesterRole !== ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Seul le Super-Administrateur peut réactiver un administrateur',
        403
      );
    }

    user.status = 'ACTIVE';
    await user.save();

    await AuditService.logAction(adminId, 'USER_REACTIVATED', 'User', userId, {
      targetRole: user.role,
    });
  }

  public static async changeUserLevel(
    adminId: string,
    userId: string,
    newLevelId: string,
    requesterRole?: UserRole
  ): Promise<void> {
    const level = await EducationLevelModel.findById(newLevelId);
    if (!level) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Niveau scolaire introuvable', 404);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND, 'Utilisateur introuvable', 404);
    }

    if (user.role === ROLES.SUPER_ADMIN || (user.role === ROLES.ADMIN && requesterRole !== ROLES.SUPER_ADMIN)) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Action non autorisée sur ce profil',
        403
      );
    }

    const previousLevelId = user.primaryLevelId?.toString();
    user.primaryLevelId = new Types.ObjectId(newLevelId);
    await user.save();

    await AuditService.logAction(adminId, 'LEVEL_CHANGED', 'User', userId, {
      previousLevelId,
      newLevelId,
    });
  }
}

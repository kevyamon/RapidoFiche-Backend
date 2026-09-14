import { UserModel, IUserDocument } from '../models/user.model';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { ROLES } from '../constants/roles.constants';
import { env } from '../config/env.config';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/token.utils';
import { verifyGoogleToken } from '../integrations/auth/google-auth.service';
import { AuditService } from './audit.service';
import {
  AdminRegisterInput,
  AdminLoginInput,
  AdminGoogleAuthInput,
} from '../schemas/admin-auth.schema';
import { logger } from '../utils/logger.utils';

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AdminAuthResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
  };
  tokens: AdminAuthTokens;
}

export class AdminAuthService {
  public static async register(
    input: AdminRegisterInput,
    ipAddress?: string
  ): Promise<AdminAuthResponse> {
    if (!input.adminPw || input.adminPw !== env.ADMIN_PW) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'La clé secrète d’autorisation staff fournie est incorrecte',
        401
      );
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'Un compte associé à cette adresse email existe déjà',
        409
      );
    }

    const isSuperAdmin = normalizedEmail === env.SA_MAIL.toLowerCase();
    const role = isSuperAdmin ? ROLES.SUPER_ADMIN : ROLES.ADMIN;

    const user = await UserModel.create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      passwordHash: input.password,
      role,
      status: 'ACTIVE',
      lastLoginAt: new Date(),
    });

    await AuditService.logAction(
      user.id,
      'ADMIN_REGISTERED',
      'AdminUser',
      user.id,
      { email: user.email, role, ipAddress }
    );

    logger.info('ADMIN', `Nouvel administrateur staff inscrit (${role}) : ${user.email}`);

    const tokens = this.generateAdminTokens(user);
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      tokens,
    };
  }

  public static async login(
    input: AdminLoginInput,
    ipAddress?: string
  ): Promise<AdminAuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Adresse email ou mot de passe administrateur incorrect',
        401
      );
    }

    if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Accès restreint aux membres du personnel administratif',
        403
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_SUSPENDED,
        'Votre compte administratif est suspendu ou inactif',
        403
      );
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Adresse email ou mot de passe administrateur incorrect',
        401
      );
    }

    // Auto-promotion en SUPER_ADMIN si l'email correspond au superadmin configuré
    if (normalizedEmail === env.SA_MAIL.toLowerCase() && user.role !== ROLES.SUPER_ADMIN) {
      user.role = ROLES.SUPER_ADMIN;
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuditService.logAction(
      user.id,
      'ADMIN_LOGIN',
      'AdminUser',
      user.id,
      { email: user.email, role: user.role, ipAddress }
    );

    logger.info('ADMIN', `Connexion administrative réussie : ${user.email} (${user.role})`);

    const tokens = this.generateAdminTokens(user);
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      tokens,
    };
  }

  public static async googleAuth(
    input: AdminGoogleAuthInput,
    ipAddress?: string
  ): Promise<AdminAuthResponse> {
    const googleProfile = await verifyGoogleToken(input.idToken);
    const normalizedEmail = googleProfile.email.trim().toLowerCase();

    let user = await UserModel.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: normalizedEmail }],
    });

    if (!user) {
      if (!input.adminPw || input.adminPw !== env.ADMIN_PW) {
        throw new AppError(
          ERROR_CODES.INVALID_CREDENTIALS,
          'La clé secrète staff est requise pour initialiser un compte administrateur Google',
          401
        );
      }

      const isSuperAdmin = normalizedEmail === env.SA_MAIL.toLowerCase();
      const role = isSuperAdmin ? ROLES.SUPER_ADMIN : ROLES.ADMIN;

      user = await UserModel.create({
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        email: normalizedEmail,
        googleId: googleProfile.googleId,
        role,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });

      await AuditService.logAction(
        user.id,
        'ADMIN_REGISTERED',
        'AdminUser',
        user.id,
        { email: user.email, role, provider: 'google', ipAddress }
      );
    } else {
      if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
        throw new AppError(
          ERROR_CODES.AUTH_REQUIRED,
          'Accès restreint aux membres du personnel administratif',
          403
        );
      }

      if (user.status !== 'ACTIVE') {
        throw new AppError(
          ERROR_CODES.ACCOUNT_SUSPENDED,
          'Votre compte administratif est suspendu',
          403
        );
      }

      if (!user.googleId) {
        user.googleId = googleProfile.googleId;
      }

      if (normalizedEmail === env.SA_MAIL.toLowerCase() && user.role !== ROLES.SUPER_ADMIN) {
        user.role = ROLES.SUPER_ADMIN;
      }

      user.lastLoginAt = new Date();
      await user.save();

      await AuditService.logAction(
        user.id,
        'ADMIN_LOGIN',
        'AdminUser',
        user.id,
        { email: user.email, role: user.role, provider: 'google', ipAddress }
      );
    }

    const tokens = this.generateAdminTokens(user);
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      tokens,
    };
  }

  private static generateAdminTokens(user: IUserDocument): AdminAuthTokens {
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    return { accessToken, refreshToken };
  }
}

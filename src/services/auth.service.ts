import { Types } from 'mongoose';
import { UserModel, IUserDocument } from '../models/user.model';
import { EducationLevelModel } from '../models/education-level.model';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { ROLES } from '../constants/roles.constants';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/token.utils';
import { verifyGoogleToken } from '../integrations/auth/google-auth.service';
import {
  RegisterInput,
  LoginInput,
  GoogleAuthInput,
} from '../schemas/auth.schema';
import { logger } from '../utils/logger.utils';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    primaryLevelId?: string;
    status: string;
  };
  tokens: AuthTokens;
}

export class AuthService {
  public static async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await UserModel.findOne({ email: input.email }).lean();
    if (existingUser) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'Un compte associé à cette adresse email existe déjà',
        409
      );
    }

    const level = await EducationLevelModel.findById(input.primaryLevelId).lean();
    if (!level || !level.active) {
      throw new AppError(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'Le niveau pédagogique sélectionné n’existe pas ou n’est plus actif',
        404
      );
    }

    const user = await UserModel.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash: input.password,
      role: ROLES.TEACHER,
      primaryLevelId: new Types.ObjectId(input.primaryLevelId),
      status: 'ACTIVE',
      lastLoginAt: new Date(),
    });

    logger.info('AUTH', `Nouvel enseignant inscrit : ${user.email}`, {
      userId: user.id,
      levelId: input.primaryLevelId,
    });

    const tokens = this.generateUserTokens(user);
    return {
      user: user.toJSON(),
      tokens,
    };
  }

  public static async login(input: LoginInput): Promise<AuthResponse> {
    const user = await UserModel.findOne({ email: input.email }).select(
      '+passwordHash'
    );

    if (!user) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Adresse email ou mot de passe incorrect',
        401
      );
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_SUSPENDED,
        'Votre compte a été suspendu par l’administration',
        403
      );
    }

    if (user.status === 'DELETED') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_NOT_FOUND,
        'Ce compte a été clôturé',
        404
      );
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Adresse email ou mot de passe incorrect',
        401
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    logger.info('AUTH', `Connexion réussie : ${user.email}`);

    const tokens = this.generateUserTokens(user);
    return {
      user: user.toJSON(),
      tokens,
    };
  }

  public static async googleAuth(input: GoogleAuthInput): Promise<AuthResponse> {
    const googleProfile = await verifyGoogleToken(input.idToken);

    let user = await UserModel.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
    });

    if (!user) {
      if (!input.primaryLevelId) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          'La sélection d’un niveau principal est obligatoire pour finaliser l’inscription',
          422
        );
      }

      user = await UserModel.create({
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        email: googleProfile.email,
        googleId: googleProfile.googleId,
        role: ROLES.TEACHER,
        primaryLevelId: new Types.ObjectId(input.primaryLevelId),
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });

      logger.info('AUTH', `Nouvel utilisateur créé via Google : ${user.email}`);
    } else {
      if (!user.googleId) {
        user.googleId = googleProfile.googleId;
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_SUSPENDED,
        'Votre compte est actuellement suspendu',
        403
      );
    }

    const tokens = this.generateUserTokens(user);
    return {
      user: user.toJSON(),
      tokens,
    };
  }

  public static async refreshToken(token: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.userId);

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Utilisateur introuvable ou compte inactif',
        401
      );
    }

    return this.generateUserTokens(user);
  }

  private static generateUserTokens(user: IUserDocument): AuthTokens {
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      primaryLevelId: user.primaryLevelId ? user.primaryLevelId.toString() : undefined,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    return { accessToken, refreshToken };
  }
}

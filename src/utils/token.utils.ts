import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { UserRole } from '../constants/roles.constants';
import { AppError } from './app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  primaryLevelId?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion?: number;
}

export interface LessonAccessTokenPayload {
  userId: string;
  lessonId: string;
  levelId: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(
        ERROR_CODES.TOKEN_EXPIRED,
        'Votre jeton d’accès a expiré',
        401
      );
    }
    throw new AppError(
      ERROR_CODES.TOKEN_INVALID,
      'Jeton d’accès invalide ou altéré',
      401
    );
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(
        ERROR_CODES.TOKEN_EXPIRED,
        'Votre session a expiré. Veuillez vous reconnecter',
        401
      );
    }
    throw new AppError(
      ERROR_CODES.TOKEN_INVALID,
      'Session invalide',
      401
    );
  }
}

export function generateLessonAccessToken(payload: LessonAccessTokenPayload): string {
  // Jeton éphémère de 15 minutes pour visionner une fiche
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyLessonAccessToken(token: string): LessonAccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as LessonAccessTokenPayload;
  } catch {
    throw new AppError(
      ERROR_CODES.TOKEN_INVALID,
      'Jeton d’accès à la fiche expiré ou non autorisé',
      403
    );
  }
}

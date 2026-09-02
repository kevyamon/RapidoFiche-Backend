import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/token.utils';
import { UserModel } from '../models/user.model';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { UserRole } from '../constants/roles.constants';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        primaryLevelId?: string;
        email: string;
        status: string;
      };
      tokenPayload?: AccessTokenPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      throw AppError.unauthorized('Veuillez vous connecter pour accéder à cette fonctionnalité');
    }

    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.userId).lean();

    if (!user) {
      throw AppError.unauthorized('Compte utilisateur inexistant');
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_SUSPENDED,
        'Votre compte a été suspendu par l’administration',
        403
      );
    }

    if (user.status === 'DELETED') {
      throw AppError.unauthorized('Compte clôturé');
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      primaryLevelId: user.primaryLevelId ? user.primaryLevelId.toString() : undefined,
      email: user.email,
      status: user.status,
    };
    req.tokenPayload = payload;

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.userId).lean();

    if (user && user.status === 'ACTIVE') {
      req.user = {
        id: user._id.toString(),
        role: user.role,
        primaryLevelId: user.primaryLevelId ? user.primaryLevelId.toString() : undefined,
        email: user.email,
        status: user.status,
      };
      req.tokenPayload = payload;
    }

    next();
  } catch {
    next();
  }
}

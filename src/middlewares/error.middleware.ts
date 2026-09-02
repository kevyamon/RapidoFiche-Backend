import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { ApiErrorResponse, ApiErrorDetail } from '../contracts/api.types';
import { logger } from '../utils/logger.utils';
import { env } from '../config/env.config';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response<ApiErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // 1. Erreur applicative opérationnelle (AppError)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('SYSTEM', `Erreur 500 sur ${req.method} ${req.path}`, {
        code: err.code,
        message: err.message,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? [],
      },
    });
    return;
  }

  // 2. Erreur de validation Zod
  if (err instanceof ZodError) {
    const formattedDetails: ApiErrorDetail[] = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      rule: issue.code,
    }));

    res.status(422).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Les données transmises dans la requête sont invalides',
        details: formattedDetails,
      },
    });
    return;
  }

  // 3. Erreur de duplication MongoDB (Code 11000)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    const keyPattern = (err as { keyPattern?: Record<string, number> }).keyPattern;
    const duplicatedField = keyPattern ? Object.keys(keyPattern)[0] : 'champ';

    res.status(409).json({
      success: false,
      error: {
        code: ERROR_CODES.CONFLICT,
        message: `Une entrée avec cette valeur pour '${duplicatedField}' existe déjà`,
        details: [{ field: duplicatedField, message: 'Valeur déjà utilisée' }],
      },
    });
    return;
  }

  // 4. Erreur d'ObjectId Mongoose invalide (CastError)
  if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "L'identifiant fourni est invalide",
        details: [],
      },
    });
    return;
  }

  // 5. Erreurs de Token JWT
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const errorName = (err as { name: string }).name;
    if (errorName === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_EXPIRED,
          message: 'Votre session a expiré. Veuillez vous reconnecter',
          details: [],
        },
      });
      return;
    }
    if (errorName === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_INVALID,
          message: 'Jeton de session invalide',
          details: [],
        },
      });
      return;
    }
  }

  // 6. Erreur interne inattendue (500)
  const unexpectedError = err instanceof Error ? err : new Error(String(err));
  logger.error('SYSTEM', `Erreur non interceptée sur ${req.method} ${req.path}`, {
    message: unexpectedError.message,
    stack: env.isProduction ? undefined : unexpectedError.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Une erreur technique interne est survenue sur le serveur',
      details: [],
    },
  });
};

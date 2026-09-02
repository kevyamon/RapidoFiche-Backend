import { ERROR_CODES, ERROR_HTTP_STATUS, ErrorCode } from '../constants/errors.constants';
import { ApiErrorDetail } from '../contracts/api.types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: ApiErrorDetail[];

  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? ERROR_HTTP_STATUS[code] ?? 500;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  public static unauthorized(message = 'Authentification requise pour cette action'): AppError {
    return new AppError(ERROR_CODES.AUTH_REQUIRED, message, 401);
  }

  public static forbidden(message = 'Accès non autorisé à cette ressource'): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }

  public static subscriptionRequired(
    message = 'Un abonnement actif est requis pour consulter cette fiche'
  ): AppError {
    return new AppError(ERROR_CODES.SUBSCRIPTION_REQUIRED, message, 403);
  }

  public static subscriptionExpired(
    message = 'Votre abonnement a expiré. Veuillez le renouveler pour continuer'
  ): AppError {
    return new AppError(ERROR_CODES.SUBSCRIPTION_EXPIRED, message, 403);
  }

  public static levelAccessDenied(
    message = 'Votre abonnement actuel ne couvre pas ce niveau pédagogique'
  ): AppError {
    return new AppError(ERROR_CODES.LEVEL_ACCESS_DENIED, message, 403);
  }

  public static notFound(message = 'Ressource introuvable'): AppError {
    return new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, message, 404);
  }

  public static conflict(message = 'Une ressource identique existe déjà'): AppError {
    return new AppError(ERROR_CODES.CONFLICT, message, 409);
  }

  public static validation(
    message = 'Les données transmises sont invalides',
    details?: ApiErrorDetail[]
  ): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
  }

  public static rateLimited(
    message = 'Trop de requêtes effectuées. Veuillez réessayer ultérieurement'
  ): AppError {
    return new AppError(ERROR_CODES.RATE_LIMITED, message, 429);
  }

  public static internal(message = 'Une erreur interne inattendue est survenue'): AppError {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, message, 500);
  }
}

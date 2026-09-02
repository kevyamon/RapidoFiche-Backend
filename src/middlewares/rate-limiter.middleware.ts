import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/errors.constants';
import { ApiErrorResponse } from '../contracts/api.types';
import { env } from '../config/env.config';

const createCustomHandler = (message: string) => {
  return (_req: Request, res: Response<ApiErrorResponse>) => {
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message,
        details: [],
      },
    });
  };
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomHandler(
    'Trop de requêtes effectuées depuis votre adresse IP. Veuillez patienter quelques minutes'
  ),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomHandler(
    'Trop de tentatives de connexion ou d’inscription. Veuillez patienter 15 minutes'
  ),
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomHandler(
    'Trop de demandes de paiement initiées. Veuillez patienter quelques instants'
  ),
});

export const lessonAccessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isProduction ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomHandler(
    'Fréquence de consultation trop élevée. Veuillez ralentir vos requêtes'
  ),
});

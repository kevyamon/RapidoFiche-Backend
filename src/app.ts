import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.config';
import { apiRouter } from './routes/api.router';
import { errorHandler } from './middlewares/error.middleware';
import { globalLimiter } from './middlewares/rate-limiter.middleware';
import { AppError } from './utils/app-error.utils';

export function createApp(): Express {
  const app = express();

  // 1. En-têtes de sécurité HTTP (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. Gestion stricte du CORS (Cahier des Charges Section 104)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin) || env.isDevelopment) {
          callback(null, true);
        } else {
          callback(new AppError('FORBIDDEN', 'Origine CORS non autorisée', 403));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Parsers de corps de requête et cookies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Rate limiting global
  app.use('/api', globalLimiter);

  // 5. Point de contrôle santé (CDC Section 133)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 6. Montage du routeur API versionné
  app.use('/api/v1', apiRouter);

  // 7. Route 404 pour routes inconnues
  app.use((_req: Request, _res: Response) => {
    throw AppError.notFound('La route demandée n’existe pas sur cette API');
  });

  // 8. Gestionnaire d'erreurs centralisé
  app.use(errorHandler);

  return app;
}

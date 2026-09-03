import { createApp } from './app';
import { env } from './config/env.config';
import { connectDatabase, disconnectDatabase } from './config/database.config';
import { BootstrapService } from './services/bootstrap.service';
import { logger } from './utils/logger.utils';

async function bootstrap() {
  try {
    // 1. Connexion à la base de données MongoDB
    await connectDatabase();

    // 2. Initialisation automatique du référentiel (Cycles, 9 Niveaux, Matières, Offre 200F)
    await BootstrapService.autoSeedIfEmpty();

    // 3. Initialisation de l'application Express
    const app = createApp();

    // 3. Démarrage du serveur HTTP
    const server = app.listen(env.PORT, () => {
      logger.info(
        'SYSTEM',
        `Serveur RapidoFiche Backend démarré en mode ${env.NODE_ENV} sur le port ${env.PORT}`
      );
      logger.info('SYSTEM', `Point de santé : http://localhost:${env.PORT}/health`);
      logger.info('SYSTEM', `API Base URL : http://localhost:${env.PORT}/api/v1`);
    });

    // 4. Arrêt gracieux (Graceful Shutdown)
    const gracefulShutdown = async (signal: string) => {
      logger.info('SYSTEM', `Signal ${signal} reçu. Fermeture gracieuse du serveur...`);
      server.close(async () => {
        logger.info('SYSTEM', 'Serveur HTTP fermé');
        await disconnectDatabase();
        process.exit(0);
      });

      // Forcer l'arrêt après 10s si des connexions traînent
      setTimeout(() => {
        logger.error('SYSTEM', 'Fermeture forcée après timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('SYSTEM', 'Échec critique lors du démarrage du serveur', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Gestion des erreurs non interceptées
process.on('unhandledRejection', (reason) => {
  logger.error('SYSTEM', 'Promesse rejetée non gérée', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('SYSTEM', 'Exception non interceptée', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

bootstrap();

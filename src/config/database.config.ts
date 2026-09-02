import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from '../utils/logger.utils';

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.connection.on('connected', () => {
      logger.info('SYSTEM', 'Connexion établie avec succès à MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('SYSTEM', 'Erreur sur la connexion MongoDB', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('SYSTEM', 'Déconnexion de MongoDB détectée');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('SYSTEM', 'Reconnexion réussie à MongoDB');
    });

    return await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: env.isProduction ? 50 : 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: !env.isProduction,
    });
  } catch (error) {
    logger.error('SYSTEM', 'Échec critique de connexion à MongoDB', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('SYSTEM', 'Connexion MongoDB fermée proprement');
  } catch (error) {
    logger.error('SYSTEM', 'Erreur lors de la déconnexion MongoDB', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

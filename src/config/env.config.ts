import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI est obligatoire')
    .default('mongodb://localhost:27017/rapidofiche'),

  // Secrets JWT
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET doit contenir au moins 16 caractères')
    .default('cle_secrete_par_defaut_pour_le_dev_rapidofiche_2026'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET doit contenir au moins 16 caractères')
    .default('cle_refresh_secrete_dev_rapidofiche_2026_securisee'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Sécurité Réseau & CORS
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // Stockage de Fichiers (Cloudinary / Local)
  STORAGE_PROVIDER: z.enum(['cloudinary', 'local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // Passerelle de Paiement (GeniusPay / Mock)
  PAYMENT_PROVIDER: z.enum(['geniuspay', 'mock']).default('mock'),
  GENIUSPAY_API_KEY: z.string().optional().default(''),
  GENIUSPAY_API_SECRET: z.string().optional().default(''),
  GENIUSPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  GENIUSPAY_BASE_URL: z
    .string()
    .default('https://pay.genius.ci/api/v1/merchant'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Erreur critique de configuration environnementale :');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isTest: parsedEnv.data.NODE_ENV === 'test',
  corsOrigins: parsedEnv.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
};

export type EnvConfig = typeof env;

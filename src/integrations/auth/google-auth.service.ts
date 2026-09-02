import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.config';
import { AppError } from '../../utils/app-error.utils';
import { ERROR_CODES } from '../../constants/errors.constants';
import { logger } from '../../utils/logger.utils';

export interface GooglePayloadResult {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(
  idToken: string
): Promise<GooglePayloadResult> {
  try {
    if (!env.GOOGLE_CLIENT_ID && env.isDevelopment) {
      logger.warn(
        'AUTH',
        'GOOGLE_CLIENT_ID non configuré en dev. Utilisation du mode test pour Google Auth'
      );
      return {
        googleId: 'google_dev_mock_id_123',
        email: 'enseignant.test@rapidofiche.ci',
        firstName: 'Koffi',
        lastName: 'Yao',
      };
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      throw new AppError(
        ERROR_CODES.TOKEN_INVALID,
        'Jeton Google invalide : informations de profil manquantes',
        401
      );
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      firstName: payload.given_name || 'Enseignant',
      lastName: payload.family_name || 'RapidoFiche',
      picture: payload.picture,
    };
  } catch (error) {
    logger.error('AUTH', 'Échec de vérification du jeton Google côté serveur', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(
      ERROR_CODES.TOKEN_INVALID,
      'Authentification Google échouée : jeton invalide',
      401
    );
  }
}

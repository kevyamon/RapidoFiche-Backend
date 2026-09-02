import { connectDatabase, disconnectDatabase } from '../config/database.config';
import { UserModel } from '../models/user.model';
import { ROLES } from '../constants/roles.constants';
import { logger } from '../utils/logger.utils';

async function seedAdmin() {
  try {
    await connectDatabase();
    logger.info('SYSTEM', 'Initialisation des comptes d’administration...');

    // Super Administrateur
    const adminEmail = 'admin@rapidofiche.ci';
    const existingAdmin = await UserModel.findOne({ email: adminEmail });

    if (!existingAdmin) {
      await UserModel.create({
        firstName: 'Administrateur',
        lastName: 'RapidoFiche',
        email: adminEmail,
        passwordHash: 'RapidoAdmin2026!',
        role: ROLES.ADMIN,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });
      logger.info('SYSTEM', `Compte Administrateur créé : ${adminEmail} (Mot de passe: RapidoAdmin2026!)`);
    } else {
      logger.info('SYSTEM', `Compte Administrateur déjà existant : ${adminEmail}`);
    }

    // Gestionnaire de Contenu
    const contentEmail = 'gestionnaire@rapidofiche.ci';
    const existingContentManager = await UserModel.findOne({ email: contentEmail });

    if (!existingContentManager) {
      await UserModel.create({
        firstName: 'Gestionnaire',
        lastName: 'Contenu',
        email: contentEmail,
        passwordHash: 'RapidoContent2026!',
        role: ROLES.CONTENT_MANAGER,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });
      logger.info('SYSTEM', `Compte Content Manager créé : ${contentEmail} (Mot de passe: RapidoContent2026!)`);
    }

    logger.info('SYSTEM', 'Initialisation des administrateurs terminée avec succès !');
  } catch (error) {
    logger.error('SYSTEM', 'Erreur lors du seeding administrateur', { error });
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

seedAdmin();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { CycleModel } from '../models/cycle.model';
import { EducationLevelModel, EducationLevelCode } from '../models/education-level.model';
import { SubjectModel } from '../models/subject.model';
import { SubjectDomainModel } from '../models/subject-domain.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { UserModel } from '../models/user.model';
import { ROLES } from '../constants/roles.constants';
import { logger } from '../utils/logger.utils';

export class BootstrapService {
  public static async autoSeedIfEmpty(): Promise<void> {
    try {
      const levelCount = await EducationLevelModel.countDocuments();
      if (levelCount > 0) {
        return;
      }

      logger.info('SYSTEM', 'Base de données vide : initialisation automatique du référentiel...');

      // 1. Cycles
      const preschoolCycle = await CycleModel.findOneAndUpdate(
        { name: 'PRESCHOOL' },
        { name: 'PRESCHOOL', label: 'Préscolaire', order: 1, active: true },
        { upsert: true, new: true }
      );

      const primaryCycle = await CycleModel.findOneAndUpdate(
        { name: 'PRIMARY' },
        { name: 'PRIMARY', label: 'Primaire', order: 2, active: true },
        { upsert: true, new: true }
      );

      if (!preschoolCycle || !primaryCycle) {
        throw new Error('Impossible d’initialiser les cycles');
      }

      // 2. Les 9 Niveaux (CDC Section 11)
      const levelsData: Array<{
        cycleId: mongoose.Types.ObjectId;
        code: EducationLevelCode;
        label: string;
        order: number;
      }> = [
        { cycleId: preschoolCycle._id as mongoose.Types.ObjectId, code: 'PS', label: 'Petite Section', order: 1 },
        { cycleId: preschoolCycle._id as mongoose.Types.ObjectId, code: 'MS', label: 'Moyenne Section', order: 2 },
        { cycleId: preschoolCycle._id as mongoose.Types.ObjectId, code: 'GS', label: 'Grande Section', order: 3 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CP1', label: 'Cours Préparatoire 1ère année', order: 4 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CP2', label: 'Cours Préparatoire 2ème année', order: 5 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CE1', label: 'Cours Élémentaire 1ère année', order: 6 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CE2', label: 'Cours Élémentaire 2ème année', order: 7 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CM1', label: 'Cours Moyen 1ère année', order: 8 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CM2', label: 'Cours Moyen 2ème année', order: 9 },
      ];

      const levelMap = new Map<string, mongoose.Types.ObjectId>();

      for (const lvl of levelsData) {
        const savedLevel = await EducationLevelModel.findOneAndUpdate(
          { code: lvl.code },
          lvl,
          { upsert: true, new: true }
        );
        if (savedLevel) {
          levelMap.set(lvl.code, savedLevel._id as mongoose.Types.ObjectId);
        }
      }

      const allLevelIds = Array.from(levelMap.values());
      const primaryLevelIds = [
        levelMap.get('CP1')!,
        levelMap.get('CP2')!,
        levelMap.get('CE1')!,
        levelMap.get('CE2')!,
        levelMap.get('CM1')!,
        levelMap.get('CM2')!,
      ].filter(Boolean);

      // 3. Matières
      const subjectsData = [
        { name: 'Mathématiques', slug: 'mathematiques', levelIds: allLevelIds, order: 1 },
        { name: 'Français', slug: 'francais', levelIds: allLevelIds, order: 2 },
        { name: 'Sciences et Technologie', slug: 'sciences-technologie', levelIds: primaryLevelIds, order: 3 },
        { name: 'Histoire-Géographie', slug: 'histoire-geographie', levelIds: primaryLevelIds, order: 4 },
        { name: 'EDHC', slug: 'edhc', levelIds: primaryLevelIds, order: 5 },
      ];

      const subjectMap = new Map<string, mongoose.Types.ObjectId>();

      for (const sub of subjectsData) {
        const savedSub = await SubjectModel.findOneAndUpdate(
          { slug: sub.slug },
          sub,
          { upsert: true, new: true }
        );
        if (savedSub) {
          subjectMap.set(sub.slug, savedSub._id as mongoose.Types.ObjectId);
        }
      }

      // 4. Domaines Pédagogiques Clés
      const mathId = subjectMap.get('mathematiques');
      if (mathId) {
        await SubjectDomainModel.findOneAndUpdate(
          { subjectId: mathId, slug: 'nombres-operations' },
          { subjectId: mathId, name: 'Nombres et Opérations', slug: 'nombres-operations', order: 1, active: true },
          { upsert: true }
        );
        await SubjectDomainModel.findOneAndUpdate(
          { subjectId: mathId, slug: 'geometrie' },
          { subjectId: mathId, name: 'Géométrie et Espace', slug: 'geometrie', order: 2, active: true },
          { upsert: true }
        );
      }

      // 5. Offre Commerciale MVP (200 FCFA / 30 jours)
      await SubscriptionPlanModel.findOneAndUpdate(
        { code: 'PLAN_ESSENTIEL_200' },
        {
          code: 'PLAN_ESSENTIEL_200',
          name: 'Forfait Essentiel Enseignant',
          description: 'Accès illimité aux fiches pédagogiques du niveau de classe enseigné.',
          priceXOF: 200,
          durationDays: 30,
          features: [
            'Accès illimité à toutes les fiches de votre niveau',
            'Visionneuse sécurisée intégrée',
            'Sauvegarde hors-ligne sur votre appareil',
          ],
          active: true,
          isDefault: true,
        },
        { upsert: true }
      );

      // 6. Super Administrateur par défaut
      const adminEmail = 'admin@rapidofiche.ci';
      const existingAdmin = await UserModel.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hash = await bcrypt.hash('RapidoAdmin2026!', 12);
        await UserModel.create({
          firstName: 'Super',
          lastName: 'Admin',
          email: adminEmail,
          passwordHash: hash,
          role: ROLES.ADMIN,
          status: 'ACTIVE',
          primaryLevelId: levelMap.get('CM2'),
        });
        logger.info('SYSTEM', `Compte Administrateur initial créé : ${adminEmail}`);
      }

      logger.info('SYSTEM', 'Référentiel pédagogique initialisé avec succès !');
    } catch (err: unknown) {
      logger.error('SYSTEM', 'Erreur lors de l’auto-seeding du référentiel', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

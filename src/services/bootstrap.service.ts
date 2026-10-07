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
      // 1. Nettoyage de sécurité des anciens éléments préscolaires si présents
      await EducationLevelModel.deleteMany({ code: { $in: ['PS', 'MS', 'GS'] } });
      await CycleModel.deleteMany({ name: 'PRESCHOOL' });

      // 2. Cycle Primaire Unique
      const primaryCycle = await CycleModel.findOneAndUpdate(
        { name: 'PRIMARY' },
        { name: 'PRIMARY', label: 'Enseignement Primaire', order: 1, active: true },
        { upsert: true, new: true }
      );

      if (!primaryCycle) {
        throw new Error('Impossible d’initialiser le cycle primaire');
      }

      // 3. Les 6 Niveaux Officiels du Primaire (CP1 au CM2)
      const levelsData: Array<{
        cycleId: mongoose.Types.ObjectId;
        code: EducationLevelCode;
        label: string;
        order: number;
      }> = [
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CP1', label: 'Cours Préparatoire 1ère année', order: 1 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CP2', label: 'Cours Préparatoire 2ème année', order: 2 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CE1', label: 'Cours Élémentaire 1ère année', order: 3 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CE2', label: 'Cours Élémentaire 2ème année', order: 4 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CM1', label: 'Cours Moyen 1ère année', order: 5 },
        { cycleId: primaryCycle._id as mongoose.Types.ObjectId, code: 'CM2', label: 'Cours Moyen 2ème année', order: 6 },
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
      const ceCmLevelIds = [
        levelMap.get('CE1')!,
        levelMap.get('CE2')!,
        levelMap.get('CM1')!,
        levelMap.get('CM2')!,
      ].filter(Boolean);

      // 4. Les 7 Matières Officielles Conformes au Programme National (Document Matières)
      const subjectsData = [
        { name: 'Français', slug: 'francais', levelIds: allLevelIds, icon: 'book-open', order: 1 },
        { name: 'Mathématiques', slug: 'mathematiques', levelIds: allLevelIds, icon: 'calculator', order: 2 },
        { name: 'Éducation aux Droits de l’Homme et à la Citoyenneté (EDHC)', slug: 'edhc', levelIds: allLevelIds, icon: 'shield-check', order: 3 },
        { name: 'Arts et Culture (AEC)', slug: 'arts-culture-aec', levelIds: allLevelIds, icon: 'palette', order: 4 },
        { name: 'Éducation Physique et Sportive (EPS)', slug: 'eps', levelIds: allLevelIds, icon: 'activity', order: 5 },
        { name: 'Sciences et Technologie', slug: 'sciences-technologie', levelIds: ceCmLevelIds, icon: 'microscope', order: 6 },
        { name: 'Histoire-Géographie', slug: 'histoire-geographie', levelIds: ceCmLevelIds, icon: 'compass', order: 7 },
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

      // 5. Domaines Pédagogiques Clés
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

      // 6. Offre Commerciale MVP (200 FCFA / 30 jours)
      await SubscriptionPlanModel.findOneAndUpdate(
        { code: 'ESSENTIEL' },
        {
          code: 'ESSENTIEL',
          name: 'Forfait Essentiel Enseignant',
          description: 'Accès illimité aux fiches pédagogiques du niveau de classe enseigné.',
          price: 200,
          currency: 'XOF',
          intervalMonths: 1,
          features: [
            'Accès illimité à toutes les fiches de votre niveau',
            'Visionneuse sécurisée intégrée',
            'Sauvegarde hors-ligne sur votre appareil',
          ],
          active: true,
        },
        { upsert: true, new: true }
      );

      // 7. Super Administrateur par défaut
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

      logger.info('SYSTEM', 'Référentiel pédagogique primaire (CP1 à CM2) initialisé avec succès !');
    } catch (err: unknown) {
      logger.error('SYSTEM', 'Erreur lors de l’auto-seeding du référentiel', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

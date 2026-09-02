import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.config';
import { CycleModel } from '../models/cycle.model';
import { EducationLevelModel, EducationLevelCode } from '../models/education-level.model';
import { SubjectModel } from '../models/subject.model';
import { SubjectDomainModel } from '../models/subject-domain.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { logger } from '../utils/logger.utils';

async function seed() {
  try {
    await connectDatabase();
    logger.info('SYSTEM', 'Initialisation du référentiel pédagogique et de l’offre MVP...');

    // 1. Initialisation des Cycles (CDC Section 10)
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
      throw new Error('Échec d’initialisation des cycles');
    }

    // 2. Initialisation des 9 Niveaux (CDC Section 11)
    const levelsData: Array<{ cycleId: mongoose.Types.ObjectId; code: EducationLevelCode; label: string; order: number }> = [
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

    // 3. Initialisation des Matières Officielles (CDC Section 12)
    const maths = await SubjectModel.findOneAndUpdate(
      { slug: 'mathematiques' },
      {
        name: 'Mathématiques',
        slug: 'mathematiques',
        levelIds: allLevelIds,
        icon: 'calculator',
        order: 1,
        active: true,
      },
      { upsert: true, new: true }
    );

    const francais = await SubjectModel.findOneAndUpdate(
      { slug: 'francais' },
      {
        name: 'Français',
        slug: 'francais',
        levelIds: allLevelIds,
        icon: 'book-open',
        order: 2,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'sciences-et-technologie' },
      {
        name: 'Sciences et Technologie',
        slug: 'sciences-et-technologie',
        levelIds: primaryLevelIds,
        icon: 'microscope',
        order: 3,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'histoire-geographie' },
      {
        name: 'Histoire-Géographie',
        slug: 'histoire-geographie',
        levelIds: primaryLevelIds,
        icon: 'compass',
        order: 4,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'edhc' },
      {
        name: 'EDHC',
        slug: 'edhc',
        levelIds: allLevelIds,
        icon: 'shield-check',
        order: 5,
        active: true,
      },
      { upsert: true, new: true }
    );

    // 4. Domaines d'apprentissage (CDC Section 13)
    const mathDomains = [
      { name: 'Numération', slug: 'numeration', order: 1 },
      { name: 'Calcul', slug: 'calcul', order: 2 },
      { name: 'Mesures', slug: 'mesures', order: 3 },
      { name: 'Géométrie', slug: 'geometrie', order: 4 },
      { name: 'Problèmes', slug: 'problemes', order: 5 },
    ];

    for (const d of mathDomains) {
      await SubjectDomainModel.findOneAndUpdate(
        { subjectId: maths._id, slug: d.slug },
        { ...d, subjectId: maths._id, active: true },
        { upsert: true }
      );
    }

    const francaisDomains = [
      { name: 'Lecture', slug: 'lecture', order: 1 },
      { name: 'Écriture', slug: 'ecriture', order: 2 },
      { name: 'Vocabulaire', slug: 'vocabulaire', order: 3 },
      { name: 'Grammaire', slug: 'grammaire', order: 4 },
      { name: 'Conjugaison', slug: 'conjugaison', order: 5 },
      { name: 'Orthographe', slug: 'orthographe', order: 6 },
    ];

    for (const d of francaisDomains) {
      await SubjectDomainModel.findOneAndUpdate(
        { subjectId: francais._id, slug: d.slug },
        { ...d, subjectId: francais._id, active: true },
        { upsert: true }
      );
    }

    // 5. Initialisation du Plan MVP Essentiel (CDC Section 39 & 40)
    await SubscriptionPlanModel.findOneAndUpdate(
      { code: 'ESSENTIEL' },
      {
        code: 'ESSENTIEL',
        name: 'Plan Essentiel',
        description: 'Accès complet aux fiches pédagogiques de votre niveau de classe',
        price: 200,
        currency: 'XOF',
        intervalMonths: 1,
        features: [
          'Fiches pédagogiques du niveau principal',
          'Consultation en ligne illimitée',
          'Gestion des fiches favorites',
          'Historique de consultation',
          'Accès PWA et mode hors connexion contrôlé',
        ],
        active: true,
      },
      { upsert: true, new: true }
    );

    logger.info('SYSTEM', 'Référentiel pédagogique et Plan Essentiel 200 FCFA initialisés avec succès !');
  } catch (error) {
    logger.error('SYSTEM', 'Erreur lors du seeding pédagogique', { error });
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

seed();

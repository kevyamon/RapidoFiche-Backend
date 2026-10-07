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
    logger.info('SYSTEM', 'Initialisation du référentiel pédagogique primaire (CP1 à CM2)...');

    // 1. Nettoyage de sécurité des anciens éléments préscolaires
    await EducationLevelModel.deleteMany({ code: { $in: ['PS', 'MS', 'GS'] } });
    await CycleModel.deleteMany({ name: 'PRESCHOOL' });

    // 2. Cycle Primaire Unique
    const primaryCycle = await CycleModel.findOneAndUpdate(
      { name: 'PRIMARY' },
      { name: 'PRIMARY', label: 'Enseignement Primaire', order: 1, active: true },
      { upsert: true, new: true }
    );

    if (!primaryCycle) {
      throw new Error('Échec d’initialisation du cycle primaire');
    }

    // 3. Initialisation des 6 Niveaux du Primaire
    const levelsData: Array<{ cycleId: mongoose.Types.ObjectId; code: EducationLevelCode; label: string; order: number }> = [
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

    // 4. Initialisation des 7 Matières Officielles (Document Matières)
    const francais = await SubjectModel.findOneAndUpdate(
      { slug: 'francais' },
      {
        name: 'Français',
        slug: 'francais',
        levelIds: allLevelIds,
        icon: 'book-open',
        order: 1,
        active: true,
      },
      { upsert: true, new: true }
    );

    const maths = await SubjectModel.findOneAndUpdate(
      { slug: 'mathematiques' },
      {
        name: 'Mathématiques',
        slug: 'mathematiques',
        levelIds: allLevelIds,
        icon: 'calculator',
        order: 2,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'edhc' },
      {
        name: 'Éducation aux Droits de l’Homme et à la Citoyenneté (EDHC)',
        slug: 'edhc',
        levelIds: allLevelIds,
        icon: 'shield-check',
        order: 3,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'arts-culture-aec' },
      {
        name: 'Arts et Culture (AEC)',
        slug: 'arts-culture-aec',
        levelIds: allLevelIds,
        icon: 'palette',
        order: 4,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'eps' },
      {
        name: 'Éducation Physique et Sportive (EPS)',
        slug: 'eps',
        levelIds: allLevelIds,
        icon: 'activity',
        order: 5,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'sciences-technologie' },
      {
        name: 'Sciences et Technologie',
        slug: 'sciences-technologie',
        levelIds: ceCmLevelIds,
        icon: 'microscope',
        order: 6,
        active: true,
      },
      { upsert: true, new: true }
    );

    await SubjectModel.findOneAndUpdate(
      { slug: 'histoire-geographie' },
      {
        name: 'Histoire-Géographie',
        slug: 'histoire-geographie',
        levelIds: ceCmLevelIds,
        icon: 'compass',
        order: 7,
        active: true,
      },
      { upsert: true, new: true }
    );

    // 5. Domaines d'apprentissage
    if (maths) {
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
    }

    if (francais) {
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
    }

    // 6. Plan MVP Essentiel
    await SubscriptionPlanModel.findOneAndUpdate(
      { code: 'ESSENTIEL' },
      {
        code: 'ESSENTIEL',
        name: 'Plan Essentiel Enseignant',
        description: 'Accès complet aux fiches pédagogiques de votre niveau de classe',
        price: 200,
        currency: 'XOF',
        intervalMonths: 1,
        features: [
          'Fiches pédagogiques du niveau primaire choisi',
          'Consultation en ligne illimitée',
          'Gestion des fiches favorites',
          'Historique de consultation',
          'Accès PWA et mode hors connexion sécurisé',
        ],
        active: true,
      },
      { upsert: true, new: true }
    );

    logger.info('SYSTEM', 'Référentiel pédagogique primaire (CP1 à CM2) initialisé avec succès !');
  } catch (error) {
    logger.error('SYSTEM', 'Erreur lors du seeding pédagogique', { error });
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

seed();

import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const createLessonSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(3, 'Le titre doit comporter au moins 3 caractères')
      .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
    levelId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant du niveau est invalide'),
    subjectId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant de la matière est invalide'),
    domainId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant du domaine est invalide')
      .optional(),
    term: z.coerce.number().int().min(1).max(4).optional(),
    week: z.coerce.number().int().min(1).max(52).optional(),
    periodLabel: z.string().trim().optional(),
    topic: z.string().trim().optional(),
    lessonType: z
      .enum([
        'PEDAGOGICAL_SHEET',
        'EXERCISE',
        'ASSESSMENT',
        'GUIDE',
        'RESOURCE',
        'OTHER',
      ])
      .default('PEDAGOGICAL_SHEET'),
    schoolYear: z.string().trim().optional(),
    description: z.string().trim().max(2000).optional(),
    fileAssetId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant de l’asset PDF est invalide'),
    thumbnailAssetId: z
      .string()
      .regex(OBJECT_ID_REGEX)
      .optional(),
    sourceType: z
      .enum(['OWNED', 'LICENSED', 'OFFICIAL', 'PARTNER', 'OTHER'])
      .default('OFFICIAL'),
    rightsStatus: z
      .enum(['VERIFIED', 'PENDING', 'RESTRICTED'])
      .default('VERIFIED'),
    status: z
      .enum(['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ARCHIVED'])
      .default('DRAFT'),
    order: z.coerce.number().int().default(0),
  }),
});

export const updateLessonSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant invalide'),
  }),
  body: z
    .object({
      title: z.string().trim().min(3).max(200).optional(),
      levelId: z.string().regex(OBJECT_ID_REGEX).optional(),
      subjectId: z.string().regex(OBJECT_ID_REGEX).optional(),
      domainId: z.string().regex(OBJECT_ID_REGEX).optional().nullable(),
      term: z.coerce.number().int().min(1).max(4).optional().nullable(),
      week: z.coerce.number().int().min(1).max(52).optional().nullable(),
      periodLabel: z.string().trim().optional().nullable(),
      topic: z.string().trim().optional().nullable(),
      lessonType: z
        .enum([
          'PEDAGOGICAL_SHEET',
          'EXERCISE',
          'ASSESSMENT',
          'GUIDE',
          'RESOURCE',
          'OTHER',
        ])
        .optional(),
      schoolYear: z.string().trim().optional().nullable(),
      description: z.string().trim().max(2000).optional().nullable(),
      fileAssetId: z.string().regex(OBJECT_ID_REGEX).optional(),
      thumbnailAssetId: z.string().regex(OBJECT_ID_REGEX).optional().nullable(),
      sourceType: z
        .enum(['OWNED', 'LICENSED', 'OFFICIAL', 'PARTNER', 'OTHER'])
        .optional(),
      rightsStatus: z
        .enum(['VERIFIED', 'PENDING', 'RESTRICTED'])
        .optional(),
      status: z
        .enum(['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ARCHIVED'])
        .optional(),
      order: z.coerce.number().int().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    }),
});

export const queryLessonsSchema = z.object({
  query: z.object({
    levelId: z.string().regex(OBJECT_ID_REGEX).optional(),
    subjectId: z.string().regex(OBJECT_ID_REGEX).optional(),
    domainId: z.string().regex(OBJECT_ID_REGEX).optional(),
    week: z.coerce.number().int().min(1).max(52).optional(),
    term: z.coerce.number().int().min(1).max(4).optional(),
    schoolYear: z.string().trim().optional(),
    lessonType: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const lessonIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant de fiche invalide'),
  }),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>['body'];
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>['body'];
export type QueryLessonsInput = z.infer<typeof queryLessonsSchema>['query'];

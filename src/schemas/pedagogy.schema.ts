import { z } from 'zod';
import { EDUCATION_LEVEL_CODES } from '../models/education-level.model';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const createLevelSchema = z.object({
  body: z.object({
    cycleId: z.string().regex(OBJECT_ID_REGEX, 'Identifiant de cycle invalide'),
    code: z.enum(EDUCATION_LEVEL_CODES),
    label: z.string().trim().min(2, 'Le libellé doit comporter au moins 2 caractères'),
    order: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
  }),
});

export const updateLevelSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant invalide'),
  }),
  body: z
    .object({
      cycleId: z.string().regex(OBJECT_ID_REGEX).optional(),
      code: z.enum(EDUCATION_LEVEL_CODES).optional(),
      label: z.string().trim().min(2).optional(),
      order: z.number().int().nonnegative().optional(),
      active: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    }),
});

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Le slug doit contenir uniquement des lettres, chiffres et tirets'),
    levelIds: z
      .array(z.string().regex(OBJECT_ID_REGEX, 'Identifiant de niveau invalide'))
      .min(1, 'Au moins un niveau doit être sélectionné'),
    icon: z.string().trim().default('book-open'),
    order: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
  }),
});

export const updateSubjectSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant invalide'),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      levelIds: z
        .array(z.string().regex(OBJECT_ID_REGEX))
        .min(1)
        .optional(),
      icon: z.string().trim().optional(),
      order: z.number().int().nonnegative().optional(),
      active: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    }),
});

export const createDomainSchema = z.object({
  body: z.object({
    subjectId: z.string().regex(OBJECT_ID_REGEX, 'Identifiant de matière invalide'),
    levelIds: z
      .array(z.string().regex(OBJECT_ID_REGEX))
      .optional(),
    name: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Le slug doit être valide'),
    order: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
  }),
});

export const updateDomainSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant invalide'),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      slug: z.string().trim().toLowerCase().optional(),
      order: z.number().int().nonnegative().optional(),
      active: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    }),
});

export const querySubjectsSchema = z.object({
  query: z.object({
    levelId: z.string().regex(OBJECT_ID_REGEX).optional(),
  }),
});

export const queryDomainsSchema = z.object({
  query: z.object({
    subjectId: z.string().regex(OBJECT_ID_REGEX, 'subjectId est obligatoire'),
    levelId: z.string().regex(OBJECT_ID_REGEX).optional(),
  }),
});

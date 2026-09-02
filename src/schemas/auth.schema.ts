import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const registerSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .trim()
      .min(2, 'Le prénom doit contenir au moins 2 caractères')
      .max(100, 'Le prénom ne peut dépasser 100 caractères'),
    lastName: z
      .string()
      .trim()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(100, 'Le nom ne peut dépasser 100 caractères'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('L’adresse email fournie n’est pas valide'),
    phone: z
      .string()
      .trim()
      .regex(
        /^[0-9+\s-]{8,20}$/,
        'Le numéro de téléphone doit être valide (ex: +225 0700000000)'
      )
      .optional(),
    password: z
      .string()
      .min(8, 'Le mot de passe doit comporter au moins 8 caractères')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
      .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
    primaryLevelId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant du niveau principal est invalide'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('L’adresse email fournie n’est pas valide'),
    password: z.string().min(1, 'Le mot de passe est obligatoire'),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Le jeton Google ID est obligatoire'),
    primaryLevelId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant du niveau est invalide')
      .optional(),
  }),
});

export const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(100).optional(),
    lastName: z.string().trim().min(2).max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\s-]{8,20}$/)
      .optional(),
    primaryLevelId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'L’identifiant du niveau est invalide')
      .optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est obligatoire'),
    newPassword: z
      .string()
      .min(8, 'Le nouveau mot de passe doit comporter au moins 8 caractères')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
      .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];

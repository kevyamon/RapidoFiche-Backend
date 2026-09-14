import { z } from 'zod';

export const adminRegisterSchema = z.object({
  body: z.object({
    firstName: z
      .string({ required_error: 'Le prénom est obligatoire' })
      .trim()
      .min(2, 'Le prénom doit comporter au moins 2 caractères')
      .max(100, 'Le prénom ne peut dépasser 100 caractères'),
    lastName: z
      .string({ required_error: 'Le nom est obligatoire' })
      .trim()
      .min(2, 'Le nom doit comporter au moins 2 caractères')
      .max(100, 'Le nom ne peut dépasser 100 caractères'),
    email: z
      .string({ required_error: 'L’adresse email professionnelle est obligatoire' })
      .trim()
      .toLowerCase()
      .email('L’adresse email fournie n’est pas valide'),
    password: z
      .string({ required_error: 'Le mot de passe est obligatoire' })
      .min(8, 'Le mot de passe administrateur doit comporter au moins 8 caractères'),
    adminPw: z
      .string({ required_error: 'La clé secrète d’autorisation staff est requise' })
      .min(1, 'La clé secrète d’autorisation staff ne peut être vide'),
  }),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'L’adresse email est obligatoire' })
      .trim()
      .toLowerCase()
      .email('L’adresse email fournie n’est pas valide'),
    password: z
      .string({ required_error: 'Le mot de passe est obligatoire' })
      .min(1, 'Le mot de passe est obligatoire'),
  }),
});

export const adminGoogleAuthSchema = z.object({
  body: z.object({
    idToken: z
      .string({ required_error: 'Le jeton Google ID est obligatoire' })
      .min(1, 'Le jeton Google ID ne peut être vide'),
    adminPw: z
      .string()
      .optional(),
  }),
});

export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>['body'];
export type AdminLoginInput = z.infer<typeof adminLoginSchema>['body'];
export type AdminGoogleAuthInput = z.infer<typeof adminGoogleAuthSchema>['body'];

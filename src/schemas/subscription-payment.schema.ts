import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const initiatePaymentSchema = z.object({
  body: z.object({
    planId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'Identifiant de plan invalide')
      .optional(),
    paymentMethod: z
      .enum(['WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'MOOV_MONEY', 'CARD', 'ALL'])
      .default('ALL'),
    customerPhone: z
      .string()
      .trim()
      .regex(/^[0-9+\s-]{8,20}$/, 'Numéro de téléphone invalide')
      .optional(),
  }),
});

export const geniusPayWebhookSchema = z.object({
  body: z.object({
    event: z.string().min(1),
    data: z.object({
      payment: z.object({
        id: z.string().min(1),
        reference: z.string().min(1),
        amount: z.number().nonnegative(),
        status: z.string().min(1),
        currency: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    }),
  }),
});

export const updateSubscriptionAdminSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_REGEX, 'Identifiant d’abonnement invalide'),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED']),
    endDate: z.string().datetime().optional(),
    reason: z
      .string()
      .trim()
      .min(3, 'La raison de la modification administrative est obligatoire'),
  }),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>['body'];
export type GeniusPayWebhookInput = z.infer<typeof geniusPayWebhookSchema>['body'];
export type UpdateSubscriptionAdminInput = z.infer<typeof updateSubscriptionAdminSchema>['body'];

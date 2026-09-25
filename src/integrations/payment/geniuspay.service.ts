import crypto from 'crypto';
import axios from 'axios';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger.utils';
import { AppError } from '../../utils/app-error.utils';
import { ERROR_CODES } from '../../constants/errors.constants';

export interface CreatePaymentSessionParams {
  amount: number;
  currency: 'XOF';
  reference: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  paymentMethod?: string;
  returnUrl?: string;
}

export interface PaymentSessionResponse {
  checkoutUrl: string;
  providerTransactionId: string;
}

export class GeniusPayService {
  public static async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<PaymentSessionResponse> {
    const cleanBaseUrl = (env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant').replace(/\/+$/, '');
    const endpoint = cleanBaseUrl.endsWith('/payments') ? cleanBaseUrl : `${cleanBaseUrl}/payments`;
    const finalReturnUrl = params.returnUrl || `${env.FRONTEND_URL}/fiches?payment=success&ref=${params.reference}`;

    try {
      const payload: Record<string, unknown> = {
        amount: Math.round(params.amount),
        currency: params.currency || 'XOF',
        reference: params.reference,
        description: params.description || 'Abonnement RapidoFiche 30 jours',
        customer: {
          name: params.customerName,
          email: params.customerEmail,
          phone: params.customerPhone || undefined,
        },
        return_url: finalReturnUrl,
        cancel_url: `${env.FRONTEND_URL}/fiches?payment=cancelled`,
        success_url: finalReturnUrl,
        error_url: `${env.FRONTEND_URL}/fiches?payment=cancelled`,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'X-API-Key': env.GENIUSPAY_API_KEY.trim(),
          'X-API-Secret': env.GENIUSPAY_API_SECRET.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const responseData = response.data;
      const checkoutUrl =
        responseData?.data?.checkout_url ||
        responseData?.checkout_url ||
        responseData?.data?.payment_url ||
        responseData?.payment_url ||
        responseData?.data?.url ||
        responseData?.url;

      const providerTransactionId =
        responseData?.data?.id ||
        responseData?.data?.payment?.id ||
        responseData?.id ||
        params.reference;

      if (!checkoutUrl) {
        logger.error('PAYMENT', 'URL de paiement introuvable dans la réponse GeniusPay', {
          response: responseData,
        });
        throw new AppError(
          ERROR_CODES.PAYMENT_FAILED,
          'La passerelle de paiement n’a pas renvoyé d’URL de paiement valide',
          502
        );
      }

      logger.info('PAYMENT', `Session GeniusPay créée avec succès : ${checkoutUrl}`);

      return {
        checkoutUrl,
        providerTransactionId,
      };
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error('PAYMENT', 'Échec d’appel à l’API GeniusPay', {
        status,
        data,
        message: error.message,
        endpoint,
      });

      const userMsg =
        data?.message ||
        data?.error ||
        'Impossible de contacter la passerelle de paiement. Veuillez vérifier votre connexion';

      throw new AppError(
        ERROR_CODES.PAYMENT_FAILED,
        userMsg,
        status && status >= 400 && status < 500 ? status : 502
      );
    }
  }

  public static verifyWebhookSignature(
    signatureHeader: string | undefined,
    rawPayload: string
  ): boolean {
    if (!env.GENIUSPAY_WEBHOOK_SECRET) {
      // En dev mock, on accepte le webhook si aucun secret n'est spécifié
      return env.isDevelopment;
    }

    if (!signatureHeader) {
      return false;
    }

    const computedSignature = crypto
      .createHmac('sha256', env.GENIUSPAY_WEBHOOK_SECRET)
      .update(rawPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(computedSignature)
    );
  }
}

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
}

export interface PaymentSessionResponse {
  checkoutUrl: string;
  providerTransactionId: string;
}

export class GeniusPayService {
  private static readonly baseUrl = env.GENIUSPAY_BASE_URL;

  public static async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<PaymentSessionResponse> {
    // Mode Mock de développement si pas de clés configurées
    if (env.PAYMENT_PROVIDER === 'mock' || !env.GENIUSPAY_API_KEY) {
      logger.info(
        'PAYMENT',
        `Mode Mock activé pour GeniusPay. Réf: ${params.reference}, Montant: ${params.amount} ${params.currency}`
      );
      return {
        checkoutUrl: `${env.FRONTEND_URL}/mock-payment?ref=${params.reference}&amount=${params.amount}`,
        providerTransactionId: `gp_mock_tx_${Date.now()}`,
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        {
          amount: params.amount,
          currency: params.currency,
          reference: params.reference,
          description: params.description,
          customer: {
            name: params.customerName,
            email: params.customerEmail,
            phone: params.customerPhone,
          },
          payment_method:
            params.paymentMethod && params.paymentMethod !== 'ALL'
              ? params.paymentMethod.toLowerCase()
              : undefined,
          return_url: `${env.FRONTEND_URL}/dashboard?payment=success&ref=${params.reference}`,
          cancel_url: `${env.FRONTEND_URL}/dashboard?payment=cancelled`,
        },
        {
          headers: {
            'X-API-Key': env.GENIUSPAY_API_KEY,
            'X-API-Secret': env.GENIUSPAY_API_SECRET,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return {
        checkoutUrl:
          response.data?.checkout_url ||
          response.data?.payment_url ||
          response.data?.data?.checkout_url,
        providerTransactionId:
          response.data?.id ||
          response.data?.data?.id ||
          params.reference,
      };
    } catch (error) {
      logger.error('PAYMENT', 'Échec d’appel à l’API GeniusPay', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(
        ERROR_CODES.PAYMENT_FAILED,
        'Impossible de contacter la passerelle de paiement. Veuillez réessayer',
        502
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

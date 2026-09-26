import crypto from 'crypto';
import axios from 'axios';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger.utils';
import { AppError } from '../../utils/app-error.utils';
import { ERROR_CODES } from '../../constants/errors.constants';

export interface CreatePaymentSessionParams {
  amount: number;
  currency?: 'XOF';
  reference: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: string;
  returnUrl?: string;
  userId?: string;
}

export interface PaymentSessionResponse {
  checkoutUrl: string;
  providerTransactionId: string;
  providerReference?: string;
}

export interface GeniusPayPaymentDetails {
  id?: number | string;
  reference: string;
  amount: number;
  status: string;
  currency?: string;
  paymentMethod?: string;
  customer?: { name?: string; phone?: string; email?: string };
  metadata?: Record<string, unknown>;
  completedAt?: string;
}

export class GeniusPayService {
  private static getApiBaseUrl(): string {
    let rawUrl = (env.GENIUSPAY_BASE_URL || 'https://pay.genius.ci/api/v1/merchant').trim().replace(/\/+$/, '');
    if (!rawUrl.includes('/api/v1/merchant')) {
      rawUrl = rawUrl.replace(/\/api\/v1$/, '');
      rawUrl = `${rawUrl}/api/v1/merchant`;
    }
    return rawUrl;
  }

  public static async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<PaymentSessionResponse> {
    const baseUrl = this.getApiBaseUrl();
    const endpoint = baseUrl.endsWith('/payments') ? baseUrl : `${baseUrl}/payments`;
    const finalReturnUrl = params.returnUrl || `${env.FRONTEND_URL}/fiches?payment=success&ref=${params.reference}`;

    const apiKey = (env.GENIUSPAY_API_KEY || '').trim();
    const apiSecret = (env.GENIUSPAY_API_SECRET || '').trim();

    try {
      const payload: Record<string, unknown> = {
        amount: Math.max(200, Math.round(params.amount)),
        currency: params.currency || 'XOF',
        description: params.description || 'Abonnement RapidoFiche 30 jours',
        customer: {
          name: params.customerName || 'Enseignant RapidoFiche',
          email: params.customerEmail || 'enseignant@rapidofiche.ci',
          phone: params.customerPhone || undefined,
        },
        success_url: finalReturnUrl,
        error_url: `${env.FRONTEND_URL}/fiches?payment=cancelled&ref=${params.reference}`,
        metadata: {
          internalReference: params.reference,
          userId: params.userId,
          order_id: params.reference,
        },
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const responseData = response.data;
      const dataObj = responseData?.data || responseData;

      const checkoutUrl =
        dataObj?.checkout_url ||
        dataObj?.payment_url ||
        dataObj?.url ||
        dataObj?.link ||
        responseData?.checkout_url;

      const providerReference = dataObj?.reference || params.reference;
      const providerTransactionId =
        dataObj?.reference ||
        dataObj?.id?.toString() ||
        dataObj?.payment?.id?.toString() ||
        providerReference;

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

      logger.info('PAYMENT', `Session GeniusPay créée : ${providerReference} -> ${checkoutUrl}`);

      return {
        checkoutUrl,
        providerTransactionId,
        providerReference,
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
        (status === 401 || status === 403
          ? 'Clés API GeniusPay non autorisées ou expirées. Vérifiez vos identifiants Sandbox/Live'
          : status === 404
          ? 'Endpoint GeniusPay introuvable. Vérifiez l’URL de base GeniusPay'
          : 'Impossible de contacter la passerelle GeniusPay. Veuillez réessayer ultérieurement');

      throw new AppError(
        ERROR_CODES.PAYMENT_FAILED,
        userMsg,
        status && status >= 400 && status < 500 ? status : 502
      );
    }
  }

  public static async getPaymentStatus(
    reference: string
  ): Promise<GeniusPayPaymentDetails | null> {
    if (!reference || !reference.trim()) return null;

    const baseUrl = this.getApiBaseUrl();
    const cleanRef = encodeURIComponent(reference.trim());
    const endpoint = baseUrl.endsWith('/payments') ? `${baseUrl}/${cleanRef}` : `${baseUrl}/payments/${cleanRef}`;

    const apiKey = (env.GENIUSPAY_API_KEY || '').trim();
    const apiSecret = (env.GENIUSPAY_API_SECRET || '').trim();

    try {
      const response = await axios.get(endpoint, {
        headers: {
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const responseData = response.data;
      const data = responseData?.data || responseData;

      if (!data) return null;

      return {
        id: data.id,
        reference: data.reference || reference,
        amount: data.amount,
        status: (data.status || '').toLowerCase(),
        currency: data.currency || 'XOF',
        paymentMethod: data.payment_method,
        customer: data.customer,
        metadata: data.metadata,
        completedAt: data.completed_at,
      };
    } catch (error: any) {
      logger.warn('PAYMENT', `Vérification du paiement GeniusPay impossible pour ${reference}: ${error.message}`);
      return null;
    }
  }

  public static verifyWebhookSignature(
    signatureHeader: string | undefined,
    rawPayload: string,
    timestampHeader?: string
  ): boolean {
    if (!env.GENIUSPAY_WEBHOOK_SECRET) {
      return env.isDevelopment;
    }

    if (!signatureHeader) {
      return false;
    }

    const secret = env.GENIUSPAY_WEBHOOK_SECRET.trim();
    const payloadToSign = timestampHeader ? `${timestampHeader}.${rawPayload}` : rawPayload;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex');

    if (computedSignature.length !== signatureHeader.length) {
      const fallbackSignature = crypto
        .createHmac('sha256', secret)
        .update(rawPayload)
        .digest('hex');
      if (fallbackSignature.length === signatureHeader.length) {
        return crypto.timingSafeEqual(
          Buffer.from(signatureHeader),
          Buffer.from(fallbackSignature)
        );
      }
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(computedSignature)
    );
  }
}

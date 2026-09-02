import crypto from 'crypto';
import { Types } from 'mongoose';
import { PaymentModel, IPaymentDocument } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { GeniusPayService } from '../integrations/payment/geniuspay.service';
import { SubscriptionService } from './subscription.service';
import { NotificationService } from './notification.service';
import { InitiatePaymentInput, GeniusPayWebhookInput } from '../schemas/subscription-payment.schema';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { logger } from '../utils/logger.utils';

export interface PaymentInitiationResult {
  paymentId: string;
  reference: string;
  checkoutUrl: string;
  amount: number;
  currency: 'XOF';
}

export class PaymentService {
  public static async initiateSubscriptionPayment(
    userId: string,
    input: InitiatePaymentInput
  ): Promise<PaymentInitiationResult> {
    const user = await UserModel.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Compte utilisateur non autorisé');
    }

    // Récupération du plan MVP Essentiel (200 FCFA)
    let plan = null;
    if (input.planId) {
      plan = await SubscriptionPlanModel.findById(input.planId);
    }
    if (!plan) {
      plan = await SubscriptionPlanModel.findOne({ code: 'ESSENTIEL', active: true });
    }

    const amount = plan ? plan.price : 200;
    const reference = `RF_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 1. Création de la transaction en base
    const payment = await PaymentModel.create({
      userId: new Types.ObjectId(userId),
      reference,
      amount,
      currency: 'XOF',
      provider: 'geniuspay',
      status: 'CREATED',
      paymentMethod: input.paymentMethod,
    });

    // 2. Appel à l'orchestrateur GeniusPay
    const session = await GeniusPayService.createPaymentSession({
      amount,
      currency: 'XOF',
      reference,
      description: 'Abonnement mensuel RapidoFiche - 200 FCFA',
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerPhone: input.customerPhone || user.phone,
      paymentMethod: input.paymentMethod,
    });

    // 3. Mise à jour de la transaction avec l'identifiant distant
    payment.providerTransactionId = session.providerTransactionId;
    payment.status = 'PENDING';
    await payment.save();

    logger.info('PAYMENT', `Paiement initié : ${reference} (${amount} XOF)`, {
      userId,
      providerTxId: session.providerTransactionId,
    });

    return {
      paymentId: payment.id,
      reference: payment.reference,
      checkoutUrl: session.checkoutUrl,
      amount,
      currency: 'XOF',
    };
  }

  public static async processWebhook(
    payload: GeniusPayWebhookInput,
    rawPayload?: Record<string, unknown>
  ): Promise<{ received: boolean; status: string }> {
    const { payment: paymentData } = payload.data;
    const payment = await PaymentModel.findOne({ reference: paymentData.reference });

    if (!payment) {
      logger.warn('PAYMENT', `Webhook reçu pour référence inconnue : ${paymentData.reference}`);
      throw new AppError(ERROR_CODES.PAYMENT_NOT_FOUND, 'Transaction introuvable', 404);
    }

    // Idempotence : si déjà traité avec succès, on ne réapplique pas
    if (payment.status === 'SUCCESS') {
      logger.info('PAYMENT', `Webhook idempotent ignoré pour : ${payment.reference}`);
      return { received: true, status: 'ALREADY_PROCESSED' };
    }

    payment.rawCallbackPayload = rawPayload || (payload as unknown as Record<string, unknown>);
    payment.providerTransactionId = paymentData.id || payment.providerTransactionId;

    const isSuccess =
      payload.event === 'payment.completed' ||
      paymentData.status.toLowerCase() === 'completed' ||
      paymentData.status.toLowerCase() === 'success';

    if (isSuccess) {
      payment.status = 'SUCCESS';
      await payment.save();

      // Activation sécurisée de l'abonnement côté serveur
      const subscription = await SubscriptionService.activateSubscription(
        payment.userId.toString(),
        payment.id,
        payment.amount
      );

      payment.subscriptionId = new Types.ObjectId(subscription.id);
      await payment.save();

      // Envoi de la notification de confirmation
      NotificationService.notifyPaymentSuccess(
        payment.userId.toString(),
        payment.amount,
        payment.reference
      ).catch(() => {});

      logger.info('PAYMENT', `Paiement validé avec succès : ${payment.reference}`);
      return { received: true, status: 'SUCCESS' };
    }

    payment.status = 'FAILED';
    await payment.save();

    logger.warn('PAYMENT', `Paiement échoué via webhook : ${payment.reference}`);
    return { received: true, status: 'FAILED' };
  }

  public static async getTeacherPayments(userId: string): Promise<IPaymentDocument[]> {
    return PaymentModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }
}

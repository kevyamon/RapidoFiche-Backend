import crypto from 'crypto';
import { Types } from 'mongoose';
import { PaymentModel, IPaymentDocument } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { SubscriptionModel } from '../models/subscription.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { GeniusPayService } from '../integrations/payment/geniuspay.service';
import { SubscriptionService } from './subscription.service';
import { NotificationService } from './notification.service';
import { PaymentVerifyService, VerifyPaymentResult } from './payment.verify.service';
import { PaymentWebhookService } from './payment.webhook.service';
import { InitiatePaymentInput } from '../schemas/subscription-payment.schema';
import { env } from '../config/env.config';
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

    // Protection Forteresse : Ne pas autoriser un nouveau paiement si un abonnement est déjà actif
    const activeSub = await SubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'ACTIVE',
      endDate: { $gt: new Date() },
    });

    if (activeSub && activeSub.isCurrentlyActive()) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'Vous disposez déjà d’un forfait actif. Le paiement n’est pas nécessaire.',
        409
      );
    }

    let plan = await SubscriptionPlanModel.findOne({ code: 'ESSENTIEL' });
    if (!plan) {
      plan = await SubscriptionPlanModel.findOne({ active: true });
    }
    if (!plan) {
      plan = await SubscriptionPlanModel.create({
        code: 'ESSENTIEL',
        name: 'Forfait Essentiel Enseignant',
        description: 'Accès complet aux fiches pédagogiques de votre niveau de classe',
        price: 200,
        currency: 'XOF',
        intervalMonths: 1,
        features: [
          'Fiches pédagogiques de votre classe',
          'Consultation en ligne illimitée',
          'Gestion des favoris',
          'Mode hors connexion contrôlé',
        ],
        active: true,
      });
    }

    // Annuler les anciennes transactions en attente pour éviter les cumuls
    await PaymentModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        status: { $in: ['CREATED', 'PENDING'] },
      },
      {
        $set: { status: 'CANCELLED' },
      }
    );

    const amount = 200;
    const reference = `RF_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const hasGeniusPay = Boolean(
      env.GENIUSPAY_API_KEY &&
      env.GENIUSPAY_API_KEY.trim().length > 0 &&
      env.GENIUSPAY_API_SECRET &&
      env.GENIUSPAY_API_SECRET.trim().length > 0
    );

    const isMock = env.PAYMENT_PROVIDER === 'mock' && !hasGeniusPay;

    const payment = await PaymentModel.create({
      userId: new Types.ObjectId(userId),
      reference,
      amount,
      currency: 'XOF',
      provider: isMock ? 'mock' : 'geniuspay',
      status: 'CREATED',
      paymentMethod: input.paymentMethod || 'ALL',
    });

    const finalPhone = input.phoneNumber || input.customerPhone || user.phone;
    if (finalPhone && !user.phone) {
      user.phone = finalPhone;
      await user.save();
    }

    if (isMock) {
      payment.status = 'SUCCESS';
      payment.providerTransactionId = `gp_mock_tx_${Date.now()}`;
      await payment.save();

      const subscription = await SubscriptionService.activateSubscription(
        userId,
        payment.id,
        amount
      );

      payment.subscriptionId = new Types.ObjectId(subscription.id);
      await payment.save();

      NotificationService.notifyPaymentSuccess(userId, amount, reference).catch(() => {});
      logger.info('PAYMENT', `Mode Mock : Abonnement activé pour ${userId}`);

      const targetUrl =
        input.callbackUrl ||
        `${env.FRONTEND_URL}/fiches?payment=success&mock=true&ref=${reference}`;

      return {
        paymentId: payment.id,
        reference: payment.reference,
        checkoutUrl: targetUrl,
        amount,
        currency: 'XOF',
      };
    }

    const customerName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Enseignant RapidoFiche';

    const session = await GeniusPayService.createPaymentSession({
      amount,
      currency: 'XOF',
      reference,
      description: 'Abonnement mensuel RapidoFiche - 200 FCFA',
      customerName,
      customerEmail: user.email,
      customerPhone: finalPhone,
      returnUrl: input.callbackUrl,
      userId,
    });

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

  public static async verifyPaymentStatus(
    userId: string,
    queryReference?: string
  ): Promise<VerifyPaymentResult> {
    return PaymentVerifyService.verifyPaymentStatus(userId, queryReference);
  }

  public static async processWebhook(
    payload: Record<string, any>,
    rawPayload?: Record<string, unknown>
  ): Promise<{ received: boolean; status: string }> {
    return PaymentWebhookService.processWebhook(payload, rawPayload);
  }

  public static async getTeacherPayments(userId: string): Promise<IPaymentDocument[]> {
    const payments = await PaymentModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return payments as unknown as IPaymentDocument[];
  }
}

import crypto from 'crypto';
import { Types } from 'mongoose';
import { PaymentModel, IPaymentDocument } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { GeniusPayService } from '../integrations/payment/geniuspay.service';
import { SubscriptionService } from './subscription.service';
import { NotificationService } from './notification.service';
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
      logger.info('PAYMENT', `Mode Mock : Abonnement activé instantanément pour ${userId}`);

      const targetUrl = input.callbackUrl || `${env.FRONTEND_URL}/fiches?payment=success&mock=true&ref=${reference}`;

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
  ): Promise<{ verified: boolean; status: string; payment?: IPaymentDocument; message?: string }> {
    const cleanRef = queryReference?.trim();
    let payment: IPaymentDocument | null = null;

    if (cleanRef) {
      const isObjectId = Types.ObjectId.isValid(cleanRef);
      payment = await PaymentModel.findOne({
        userId: new Types.ObjectId(userId),
        $or: [
          { reference: cleanRef },
          { providerTransactionId: cleanRef },
          ...(isObjectId ? [{ _id: new Types.ObjectId(cleanRef) }] : []),
        ],
      });
    }

    if (!payment) {
      payment = await PaymentModel.findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['PENDING', 'CREATED'] },
      }).sort({ createdAt: -1 });
    }

    if (!payment) {
      const latestSuccess = await PaymentModel.findOne({
        userId: new Types.ObjectId(userId),
        status: 'SUCCESS',
      }).sort({ createdAt: -1 });

      if (latestSuccess) {
        return { verified: true, status: 'SUCCESS', payment: latestSuccess };
      }

      return { verified: false, status: 'NOT_FOUND', message: 'Aucun paiement en attente trouvé.' };
    }

    if (payment.status === 'SUCCESS') {
      return { verified: true, status: 'SUCCESS', payment };
    }

    const refToCheck = payment.providerTransactionId || payment.reference || cleanRef;
    if (refToCheck) {
      const gpDetails = await GeniusPayService.getPaymentStatus(refToCheck);

      if (gpDetails) {
        payment.rawCallbackPayload = gpDetails.metadata || (gpDetails as unknown as Record<string, unknown>);
        if (gpDetails.id) payment.providerTransactionId = gpDetails.reference || String(gpDetails.id);

        const isSuccess =
          gpDetails.status === 'completed' ||
          gpDetails.status === 'success' ||
          gpDetails.status === 'paid';

        if (isSuccess) {
          payment.status = 'SUCCESS';
          await payment.save();

          const subscription = await SubscriptionService.activateSubscription(
            payment.userId.toString(),
            payment.id,
            payment.amount
          );

          payment.subscriptionId = new Types.ObjectId(subscription.id);
          await payment.save();

          NotificationService.notifyPaymentSuccess(
            payment.userId.toString(),
            payment.amount,
            payment.reference
          ).catch(() => {});

          logger.info('PAYMENT', `Paiement vérifié avec succès via API GeniusPay : ${payment.reference}`);
          return { verified: true, status: 'SUCCESS', payment };
        }

        if (gpDetails.status === 'failed' || gpDetails.status === 'cancelled') {
          payment.status = 'FAILED';
          await payment.save();
          return { verified: false, status: 'FAILED', payment, message: 'Paiement échoué ou annulé.' };
        }
      }
    }

    return {
      verified: false,
      status: payment.status,
      payment,
      message: 'Le paiement est toujours en attente de validation.',
    };
  }

  public static async processWebhook(
    payload: Record<string, any>,
    rawPayload?: Record<string, unknown>
  ): Promise<{ received: boolean; status: string }> {
    const data = payload.data || payload;
    const transaction = data.transaction || data.payment || data;

    const reference =
      transaction.reference ||
      transaction.id ||
      data.reference ||
      data.id ||
      payload.reference ||
      payload.metadata?.internalReference ||
      payload.metadata?.order_id ||
      data.metadata?.internalReference ||
      data.metadata?.order_id;

    if (!reference) {
      logger.warn('PAYMENT', 'Webhook reçu sans référence identifiable', { payload });
      return { received: false, status: 'MISSING_REFERENCE' };
    }

    const payment = await PaymentModel.findOne({
      $or: [
        { reference: String(reference) },
        { providerTransactionId: String(reference) },
      ],
    });

    if (!payment) {
      logger.warn('PAYMENT', `Webhook pour transaction introuvable : ${reference}`);
      throw new AppError(ERROR_CODES.PAYMENT_NOT_FOUND, 'Transaction introuvable', 404);
    }

    if (payment.status === 'SUCCESS') {
      return { received: true, status: 'ALREADY_PROCESSED' };
    }

    payment.rawCallbackPayload = rawPayload || payload;
    payment.providerTransactionId = String(transaction.id || transaction.reference || reference);

    const eventName = (payload.event || '').toLowerCase();
    const txnStatus = (transaction.status || data.status || '').toLowerCase();

    const isSuccess =
      eventName === 'payment.success' ||
      eventName === 'payment.completed' ||
      txnStatus === 'completed' ||
      txnStatus === 'success' ||
      txnStatus === 'paid';

    if (isSuccess) {
      payment.status = 'SUCCESS';
      await payment.save();

      const subscription = await SubscriptionService.activateSubscription(
        payment.userId.toString(),
        payment.id,
        payment.amount
      );

      payment.subscriptionId = new Types.ObjectId(subscription.id);
      await payment.save();

      NotificationService.notifyPaymentSuccess(
        payment.userId.toString(),
        payment.amount,
        payment.reference
      ).catch(() => {});

      logger.info('PAYMENT', `Webhook validé : abonnement activé pour ${payment.reference}`);
      return { received: true, status: 'SUCCESS' };
    }

    payment.status = 'FAILED';
    await payment.save();
    return { received: true, status: 'FAILED' };
  }

  public static async getTeacherPayments(userId: string): Promise<IPaymentDocument[]> {
    const payments = await PaymentModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return payments as unknown as IPaymentDocument[];
  }
}

import { Types } from 'mongoose';
import { PaymentModel } from '../models/payment.model';
import { SubscriptionService } from './subscription.service';
import { NotificationService } from './notification.service';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { logger } from '../utils/logger.utils';

export class PaymentWebhookService {
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

      // Nettoyer les autres paiements en attente de l'utilisateur
      await PaymentModel.updateMany(
        {
          userId: payment.userId,
          _id: { $ne: payment._id },
          status: { $in: ['CREATED', 'PENDING'] },
        },
        {
          $set: { status: 'CANCELLED' },
        }
      );

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
}

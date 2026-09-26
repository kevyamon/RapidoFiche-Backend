import { Types } from 'mongoose';
import { PaymentModel, IPaymentDocument } from '../models/payment.model';
import { GeniusPayService } from '../integrations/payment/geniuspay.service';
import { SubscriptionService } from './subscription.service';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger.utils';

export interface VerifyPaymentResult {
  verified: boolean;
  status: string;
  payment?: IPaymentDocument;
  message?: string;
}

export class PaymentVerifyService {
  public static async verifyPaymentStatus(
    userId: string,
    queryReference?: string
  ): Promise<VerifyPaymentResult> {
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

      return {
        verified: false,
        status: 'NOT_FOUND',
        message: 'Aucun paiement en attente trouvé.',
      };
    }

    // Si déjà validé avec succès, renvoyer sans ré-activation
    if (payment.status === 'SUCCESS') {
      return { verified: true, status: 'SUCCESS', payment };
    }

    const refToCheck = payment.providerTransactionId || payment.reference || cleanRef;
    if (refToCheck) {
      const gpDetails = await GeniusPayService.getPaymentStatus(refToCheck);

      if (gpDetails) {
        payment.rawCallbackPayload =
          gpDetails.metadata || (gpDetails as unknown as Record<string, unknown>);
        if (gpDetails.id) {
          payment.providerTransactionId = gpDetails.reference || String(gpDetails.id);
        }

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

          // Annuler tous les autres paiements orphelins CREATED/PENDING
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

          logger.info(
            'PAYMENT',
            `Paiement vérifié avec succès via API GeniusPay : ${payment.reference}`
          );
          return { verified: true, status: 'SUCCESS', payment };
        }

        if (gpDetails.status === 'failed' || gpDetails.status === 'cancelled') {
          payment.status = 'FAILED';
          await payment.save();
          return {
            verified: false,
            status: 'FAILED',
            payment,
            message: 'Paiement échoué ou annulé.',
          };
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
}

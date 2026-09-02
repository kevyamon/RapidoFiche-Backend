import { Types } from 'mongoose';
import {
  SubscriptionModel,
  ISubscriptionDocument,
  SubscriptionStatus,
} from '../models/subscription.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';
import { logger } from '../utils/logger.utils';

export interface SubscriptionStatusInfo {
  hasSubscription: boolean;
  isActive: boolean;
  status: SubscriptionStatus;
  planName: string;
  price: number;
  startDate?: Date;
  endDate?: Date;
  daysRemaining: number;
}

export class SubscriptionService {
  public static async getCurrentSubscription(
    userId: string
  ): Promise<SubscriptionStatusInfo> {
    const subscription = await SubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    })
      .populate('planId')
      .sort({ createdAt: -1 });

    if (!subscription) {
      return {
        hasSubscription: false,
        isActive: false,
        status: 'EXPIRED',
        planName: 'Aucun abonnement actif',
        price: 200,
        daysRemaining: 0,
      };
    }

    const isActive = subscription.isCurrentlyActive();
    const now = new Date().getTime();
    const end = subscription.endDate ? new Date(subscription.endDate).getTime() : now;
    const diffDays = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    return {
      hasSubscription: true,
      isActive,
      status: isActive ? 'ACTIVE' : 'EXPIRED',
      planName: 'Plan Essentiel',
      price: 200,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      daysRemaining: isActive ? diffDays : 0,
    };
  }

  public static async activateSubscription(
    userId: string,
    paymentId: string,
    _amountPaid: number
  ): Promise<ISubscriptionDocument> {
    const plan = await SubscriptionPlanModel.findOne({ code: 'ESSENTIEL', active: true });
    if (!plan) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Plan d’abonnement introuvable', 404);
    }

    const now = new Date();
    let subscription = await SubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    let startDate = now;
    let endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Si déjà actif, on prolonge à partir de la date de fin existante
    if (subscription && subscription.isCurrentlyActive() && subscription.endDate) {
      startDate = subscription.startDate || now;
      endDate = new Date(new Date(subscription.endDate).getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    if (!subscription) {
      subscription = await SubscriptionModel.create({
        userId: new Types.ObjectId(userId),
        planId: plan._id,
        paymentId: new Types.ObjectId(paymentId),
        status: 'ACTIVE',
        startDate,
        endDate,
      });
    } else {
      subscription.planId = plan._id;
      subscription.paymentId = new Types.ObjectId(paymentId);
      subscription.status = 'ACTIVE';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();
    }

    NotificationService.notifySubscriptionActivated(userId, endDate).catch(() => {});

    logger.info('SUBSCRIPTION', `Abonnement activé pour ${userId} jusqu'au ${endDate.toISOString()}`);
    return subscription;
  }

  public static async adminUpdateSubscription(
    adminId: string,
    subscriptionId: string,
    newStatus: SubscriptionStatus,
    endDate?: Date,
    reason?: string
  ): Promise<ISubscriptionDocument> {
    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Abonnement introuvable', 404);
    }

    const previousStatus = subscription.status;
    subscription.status = newStatus;
    if (endDate) {
      subscription.endDate = endDate;
    }
    await subscription.save();

    // Traçabilité obligatoire (CDC Section 85 & 108)
    await AuditService.logAction(
      adminId,
      'SUBSCRIPTION_CHANGED',
      'Subscription',
      subscriptionId,
      {
        previousStatus,
        newStatus,
        newEndDate: endDate?.toISOString(),
        reason: reason || 'Modification manuelle administrateur',
      }
    );

    return subscription;
  }
}

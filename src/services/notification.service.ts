import { Types } from 'mongoose';
import {
  NotificationModel,
  NotificationType,
  INotificationDocument,
} from '../models/notification.model';
import { PaginationMeta } from '../contracts/api.types';
import { logger } from '../utils/logger.utils';

export class NotificationService {
  public static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<INotificationDocument> {
    const notification = await NotificationModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      message,
      data,
    });

    logger.info('USER', `Notification créée pour ${userId} : ${title}`);
    return notification;
  }

  public static async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ notifications: INotificationDocument[]; unreadCount: number; pagination: PaginationMeta }> {
    const filter = { userId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({ ...filter, readAt: { $exists: false } }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notifications: notifications as unknown as INotificationDocument[],
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public static async markAsRead(userId: string, notificationId: string): Promise<void> {
    await NotificationModel.updateOne(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      { $set: { readAt: new Date() } }
    );
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        readAt: { $exists: false },
      },
      { $set: { readAt: new Date() } }
    );
  }

  public static async notifyPaymentSuccess(
    userId: string,
    amount: number,
    reference: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      'PAYMENT_CONFIRMED',
      'Paiement confirmé',
      `Votre paiement de ${amount} FCFA (Réf: ${reference}) a été validé avec succès.`,
      { reference, amount }
    );
  }

  public static async notifySubscriptionActivated(
    userId: string,
    endDate: Date
  ): Promise<void> {
    const formattedDate = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(endDate));

    await this.createNotification(
      userId,
      'SUBSCRIPTION_ACTIVATED',
      'Abonnement actif',
      `Votre abonnement mensuel RapidoFiche est actif jusqu'au ${formattedDate}.`,
      { endDate: endDate.toISOString() }
    );
  }

  public static async notifyExpiringSoon(
    userId: string,
    daysLeft: number
  ): Promise<void> {
    await this.createNotification(
      userId,
      'SUBSCRIPTION_EXPIRING',
      'Rappel d’expiration',
      `Votre abonnement RapidoFiche expire dans ${daysLeft} jour(s). Pensez à le renouveler pour conserver l’accès à vos fiches.`,
      { daysLeft }
    );
  }
}

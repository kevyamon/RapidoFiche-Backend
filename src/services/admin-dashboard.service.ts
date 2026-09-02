import { UserModel } from '../models/user.model';
import { SubscriptionModel } from '../models/subscription.model';
import { PaymentModel } from '../models/payment.model';
import { LessonModel } from '../models/lesson.model';
import { AuditLogModel } from '../models/audit-log.model';
import { ROLES } from '../constants/roles.constants';

export interface DashboardMetrics {
  teachers: {
    total: number;
    newThisMonth: number;
  };
  subscriptions: {
    active: number;
    expired: number;
  };
  payments: {
    revenueThisMonth: number;
  };
  lessons: {
    total: number;
    published: number;
  };
  recentActivity: unknown[];
}

export class AdminDashboardService {
  public static async getMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTeachers,
      newTeachersThisMonth,
      activeSubs,
      expiredSubs,
      revenueResult,
      totalLessons,
      publishedLessons,
      recentActivity,
    ] = await Promise.all([
      // 1. Enseignants
      UserModel.countDocuments({ role: ROLES.TEACHER, status: 'ACTIVE' }),
      UserModel.countDocuments({
        role: ROLES.TEACHER,
        createdAt: { $gte: startOfMonth },
      }),

      // 2. Abonnements
      SubscriptionModel.countDocuments({
        status: 'ACTIVE',
        endDate: { $gte: now },
      }),
      SubscriptionModel.countDocuments({
        $or: [{ status: 'EXPIRED' }, { endDate: { $lt: now } }],
      }),

      // 3. Revenus réels du mois
      PaymentModel.aggregate([
        {
          $match: {
            status: 'SUCCESS',
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
          },
        },
      ]),

      // 4. Fiches
      LessonModel.countDocuments({ status: { $ne: 'ARCHIVED' } }),
      LessonModel.countDocuments({ status: 'PUBLISHED' }),

      // 5. Activité récente (Audit logs)
      AuditLogModel.find()
        .populate('actorId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const revenueThisMonth =
      revenueResult.length > 0 && revenueResult[0].totalRevenue
        ? revenueResult[0].totalRevenue
        : 0;

    return {
      teachers: {
        total: totalTeachers,
        newThisMonth: newTeachersThisMonth,
      },
      subscriptions: {
        active: activeSubs,
        expired: expiredSubs,
      },
      payments: {
        revenueThisMonth,
      },
      lessons: {
        total: totalLessons,
        published: publishedLessons,
      },
      recentActivity,
    };
  }
}

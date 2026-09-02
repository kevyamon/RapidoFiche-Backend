import { Types } from 'mongoose';
import { AuditLogModel, AuditAction, IAuditLogDocument } from '../models/audit-log.model';
import { PaginationMeta } from '../contracts/api.types';
import { logger } from '../utils/logger.utils';

export interface QueryAuditLogsInput {
  action?: string;
  entityType?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  public static async logAction(
    actorId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ): Promise<IAuditLogDocument> {
    const auditLog = await AuditLogModel.create({
      actorId: new Types.ObjectId(actorId),
      action,
      entityType,
      entityId,
      metadata,
    });

    logger.info('ADMIN', `Action auditée : ${action} sur ${entityType} (${entityId || 'N/A'}) par ${actorId}`);
    return auditLog;
  }

  public static async getAuditLogs(
    query: QueryAuditLogsInput
  ): Promise<{ logs: IAuditLogDocument[]; pagination: PaginationMeta }> {
    const filter: Record<string, unknown> = {};
    if (query.action) {
      filter.action = query.action;
    }
    if (query.entityType) {
      filter.entityType = query.entityType;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .populate('actorId', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      logs: logs as unknown as IAuditLogDocument[],
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
}

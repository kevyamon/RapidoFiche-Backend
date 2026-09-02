import { Request, Response, NextFunction } from 'express';
import { ImportBatchService } from '../services/import-batch.service';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AuditService } from '../services/audit.service';
import { UploadFileInput } from '../integrations/storage/storage.service';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class AdminOperationsController {
  public static async uploadBatch(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(
          ERROR_CODES.INVALID_FILE,
          'Aucun fichier PDF téléversé pour l’importation',
          400
        );
      }

      const uploadInputs: UploadFileInput[] = files.map((f) => ({
        buffer: f.buffer,
        originalName: f.originalname,
        mimeType: f.mimetype,
        sizeBytes: f.size,
      }));

      const batch = await ImportBatchService.processUploadedFiles(
        req.user.id,
        uploadInputs
      );

      res.status(201).json({
        success: true,
        data: batch,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getBatchById(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const batch = await ImportBatchService.getBatchById(req.params.id);
      res.status(200).json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  public static async confirmBatch(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const batch = await ImportBatchService.confirmBatch(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Lot d’importation validé et fiches créées en brouillon', batch },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getDashboardMetrics(
    _req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const metrics = await AdminDashboardService.getMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }

  public static async getAuditLogs(
    req: Request,
    res: Response<ApiPaginatedResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;

      const result = await AuditService.getAuditLogs({ page, limit, action, entityType });

      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

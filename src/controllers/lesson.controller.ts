import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { LessonService } from '../services/lesson.service';
import { StorageService } from '../integrations/storage/storage.service';
import { AssetModel } from '../models/asset.model';
import { LessonModel } from '../models/lesson.model';
import { verifyLessonAccessToken } from '../utils/token.utils';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { ERROR_CODES } from '../constants/errors.constants';

export class LessonController {
  public static async getLessons(
    req: Request,
    res: Response<ApiPaginatedResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await LessonService.getLessons(
        req.query,
        req.user?.role,
        req.user?.primaryLevelId
      );

      res.status(200).json({
        success: true,
        data: result.lessons,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getLessonById(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const lesson = await LessonService.getLessonById(req.params.id, req.user?.role);
      res.status(200).json({ success: true, data: lesson });
    } catch (error) {
      next(error);
    }
  }

  public static async requestAccess(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const accessInfo = await LessonService.requestLessonAccess(
        req.params.id,
        req.user.id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        data: accessInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async streamLessonPdf(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const token = req.query.token as string;
      if (!token) {
        throw new AppError(ERROR_CODES.TOKEN_INVALID, 'Jeton de visionneuse requis', 401);
      }

      const payload = verifyLessonAccessToken(token);
      if (payload.lessonId !== req.params.id) {
        throw new AppError(ERROR_CODES.LEVEL_ACCESS_DENIED, 'Jeton non valide pour cette fiche', 403);
      }

      const lesson = await LessonModel.findById(req.params.id);
      if (!lesson) {
        throw new AppError(ERROR_CODES.LESSON_NOT_FOUND, 'Fiche introuvable', 404);
      }

      const asset = await AssetModel.findById(lesson.fileAssetId);
      if (!asset) {
        throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Fichier PDF introuvable', 404);
      }

      const localPath = await StorageService.getLocalFilePath(asset.storageKey);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.originalName)}"`);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}

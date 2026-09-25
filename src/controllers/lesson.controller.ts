import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { LessonService } from '../services/lesson.service';
import { ContentAccessService } from '../services/content-access.service';
import { StorageService } from '../integrations/storage/storage.service';
import { AssetModel } from '../models/asset.model';
import { verifyLessonAccessToken } from '../utils/token.utils';
import { QueryLessonsInput } from '../schemas/lesson.schema';
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
        req.query as unknown as QueryLessonsInput,
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

      // Vérification temps réel en base de données de l'abonnement actif (Forteresse)
      const { lesson } = await ContentAccessService.assertCanAccessLesson(
        payload.userId,
        payload.role || 'TEACHER',
        req.params.id
      );

      const asset = await AssetModel.findById(lesson.fileAssetId);
      if (!asset) {
        throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Fichier PDF introuvable', 404);
      }

      const localPath = await StorageService.getLocalFilePath(asset.storageKey);

      // En-têtes stricts anti-téléchargement et anti-mise en cache
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="apercu-securise.pdf"');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}

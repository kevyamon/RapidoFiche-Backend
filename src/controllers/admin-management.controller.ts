import { Request, Response, NextFunction } from 'express';
import { AdminUserService } from '../services/admin-user.service';
import { AdminLessonService } from '../services/admin-lesson.service';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';

export class AdminManagementController {
  // --- Gestion des Utilisateurs Enseignants ---

  public static async getUsers(
    req: Request,
    res: Response<ApiPaginatedResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const levelId = req.query.levelId as string | undefined;

      const result = await AdminUserService.getUsers({
        page,
        limit,
        search,
        role,
        status,
        levelId,
      });

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getUserById(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await AdminUserService.getUserById(req.params.id);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  public static async suspendUser(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      await AdminUserService.suspendUser(req.user.id, req.params.id, req.body.reason);
      res.status(200).json({
        success: true,
        data: { message: 'Compte enseignant suspendu avec succès' },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async reactivateUser(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      await AdminUserService.reactivateUser(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Compte enseignant réactivé avec succès' },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async changeUserLevel(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      await AdminUserService.changeUserLevel(
        req.user.id,
        req.params.id,
        req.body.primaryLevelId
      );
      res.status(200).json({
        success: true,
        data: { message: 'Niveau de l’enseignant mis à jour avec succès' },
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Gestion du Cycle de Vie des Fiches ---

  public static async createLesson(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const lesson = await AdminLessonService.createLesson(req.user.id, req.body);
      res.status(201).json({ success: true, data: lesson });
    } catch (error) {
      next(error);
    }
  }

  public static async updateLesson(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const lesson = await AdminLessonService.updateLesson(
        req.user.id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: lesson });
    } catch (error) {
      next(error);
    }
  }

  public static async publishLesson(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const lesson = await AdminLessonService.publishLesson(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Fiche publiée avec succès', lesson },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async unpublishLesson(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const lesson = await AdminLessonService.unpublishLesson(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Fiche retirée de la publication', lesson },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async archiveLesson(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const lesson = await AdminLessonService.archiveLesson(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Fiche archivée avec succès', lesson },
      });
    } catch (error) {
      next(error);
    }
  }
}

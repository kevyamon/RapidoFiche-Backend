import { Request, Response, NextFunction } from 'express';
import { FavoriteHistoryService } from '../services/favorite-history.service';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';

export class FavoriteHistoryController {
  public static async getFavorites(
    req: Request,
    res: Response<ApiPaginatedResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await FavoriteHistoryService.getFavorites(req.user.id, page, limit);

      res.status(200).json({
        success: true,
        data: result.favorites,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async addFavorite(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      await FavoriteHistoryService.addFavorite(req.user.id, req.params.lessonId);

      res.status(201).json({
        success: true,
        data: { message: 'Fiche ajoutée à vos favoris' },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async removeFavorite(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      await FavoriteHistoryService.removeFavorite(req.user.id, req.params.lessonId);

      res.status(200).json({
        success: true,
        data: { message: 'Fiche retirée de vos favoris' },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getHistory(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const limit = parseInt(req.query.limit as string, 10) || 20;
      const history = await FavoriteHistoryService.getHistory(req.user.id, limit);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

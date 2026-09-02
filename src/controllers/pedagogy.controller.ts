import { Request, Response, NextFunction } from 'express';
import { PedagogyService } from '../services/pedagogy.service';
import { ApiSuccessResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';

export class PedagogyController {
  public static async getCycles(
    _req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const cycles = await PedagogyService.getCycles();
      res.status(200).json({ success: true, data: cycles });
    } catch (error) {
      next(error);
    }
  }

  public static async getLevels(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const levels = await PedagogyService.getLevels(req.query.cycleId as string);
      res.status(200).json({ success: true, data: levels });
    } catch (error) {
      next(error);
    }
  }

  public static async getLevelById(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const level = await PedagogyService.getLevelById(req.params.id);
      res.status(200).json({ success: true, data: level });
    } catch (error) {
      next(error);
    }
  }

  public static async getSubjects(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const subjects = await PedagogyService.getSubjects(req.query.levelId as string);
      res.status(200).json({ success: true, data: subjects });
    } catch (error) {
      next(error);
    }
  }

  public static async getTeacherSubjects(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || !req.user.primaryLevelId) {
        throw AppError.unauthorized('Aucun niveau scolaire associé à votre profil enseignant');
      }

      const subjects = await PedagogyService.getTeacherSubjects(req.user.primaryLevelId);
      res.status(200).json({ success: true, data: subjects });
    } catch (error) {
      next(error);
    }
  }

  public static async getDomains(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const subjectId = req.query.subjectId as string;
      const levelId = req.query.levelId as string;
      const domains = await PedagogyService.getDomains(subjectId, levelId);
      res.status(200).json({ success: true, data: domains });
    } catch (error) {
      next(error);
    }
  }
}

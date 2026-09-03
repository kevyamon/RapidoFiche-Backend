import { Request, Response, NextFunction } from 'express';
import { UserProfileService } from '../services/user-profile.service';
import { ApiSuccessResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';

export class UserProfileController {
  public static async updateProfile(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const updatedUser = await UserProfileService.updateProfile(
        req.user.id,
        req.body
      );

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async changePassword(
    req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      await UserProfileService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword
      );

      res.status(200).json({
        success: true,
        data: { message: 'Mot de passe modifié avec succès' },
      });
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env.config';
import { ApiSuccessResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';
import { UserModel } from '../models/user.model';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
};

export class AuthController {
  public static async register(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AuthService.register(req.body);

      res.cookie('refresh_token', result.tokens.refreshToken, COOKIE_OPTIONS);
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async login(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AuthService.login(req.body);

      res.cookie('refresh_token', result.tokens.refreshToken, COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async googleAuth(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AuthService.googleAuth(req.body);

      res.cookie('refresh_token', result.tokens.refreshToken, COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async refresh(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const token = req.cookies.refresh_token || req.body?.refreshToken;
      if (!token) {
        throw AppError.unauthorized('Aucun jeton de rafraîchissement fourni');
      }

      const tokens = await AuthService.refreshToken(token);

      res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(
    _req: Request,
    res: Response<ApiSuccessResponse<{ message: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: env.isProduction ? 'strict' : 'lax',
      });

      res.status(200).json({
        success: true,
        data: { message: 'Déconnexion réussie' },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMe(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const user = await UserModel.findById(req.user.id)
        .populate('primaryLevelId', 'code label')
        .lean();

      if (!user) {
        throw AppError.unauthorized();
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from '../services/admin-auth.service';
import { env } from '../config/env.config';
import { ApiSuccessResponse } from '../contracts/api.types';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: (env.isProduction ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
};

export class AdminAuthController {
  public static async register(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await AdminAuthService.register(req.body, ipAddress);

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
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await AdminAuthService.login(req.body, ipAddress);

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
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await AdminAuthService.googleAuth(req.body, ipAddress);

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
}

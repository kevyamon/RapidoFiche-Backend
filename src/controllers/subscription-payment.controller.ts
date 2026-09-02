import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { PaymentService } from '../services/payment.service';
import { GeniusPayService } from '../integrations/payment/geniuspay.service';
import { ApiSuccessResponse } from '../contracts/api.types';
import { AppError } from '../utils/app-error.utils';

export class SubscriptionPaymentController {
  public static async getMySubscription(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const subscriptionInfo = await SubscriptionService.getCurrentSubscription(
        req.user.id
      );

      res.status(200).json({
        success: true,
        data: subscriptionInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async initiatePayment(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const result = await PaymentService.initiateSubscriptionPayment(
        req.user.id,
        req.body
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMyPayments(
    req: Request,
    res: Response<ApiSuccessResponse<unknown>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const payments = await PaymentService.getTeacherPayments(req.user.id);

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = req.headers['x-geniuspay-signature'] as string | undefined;
      const rawBody = JSON.stringify(req.body);

      const isValid = GeniusPayService.verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        throw AppError.forbidden('Signature de webhook GeniusPay invalide');
      }

      const result = await PaymentService.processWebhook(req.body, req.body);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

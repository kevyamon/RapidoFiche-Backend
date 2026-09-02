import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { PaymentService } from '../src/services/payment.service';
import { SubscriptionService } from '../src/services/subscription.service';
import { PaymentModel } from '../src/models/payment.model';
import { UserModel } from '../src/models/user.model';
import { SubscriptionPlanModel } from '../src/models/subscription-plan.model';

describe('Tests du Workflow de Paiement et Webhook (CDC Sections 142 & 151)', () => {
  const userId = new Types.ObjectId().toString();
  const paymentId = new Types.ObjectId().toString();
  const planId = new Types.ObjectId().toString();
  const reference = 'RF_TEST_12345';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('devrait initier un paiement de 200 FCFA et renvoyer une URL de paiement', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(userId),
      firstName: 'Koffi',
      lastName: 'Yao',
      email: 'koffi.yao@rapidofiche.ci',
      status: 'ACTIVE',
    } as any);

    vi.spyOn(SubscriptionPlanModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(planId),
      code: 'ESSENTIEL',
      price: 200,
    } as any);

    vi.spyOn(PaymentModel, 'create').mockResolvedValue({
      id: paymentId,
      reference,
      save: vi.fn().mockResolvedValue(true),
    } as any);

    const result = await PaymentService.initiateSubscriptionPayment(userId, {
      paymentMethod: 'ALL',
    });

    expect(result.amount).toBe(200);
    expect(result.currency).toBe('XOF');
    expect(result.checkoutUrl).toBeDefined();
  });

  it('devrait valider le webhook GeniusPay et activer l’abonnement', async () => {
    const mockPaymentDoc = {
      _id: new Types.ObjectId(paymentId),
      id: paymentId,
      userId: new Types.ObjectId(userId),
      reference,
      amount: 200,
      status: 'PENDING',
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(PaymentModel, 'findOne').mockResolvedValue(mockPaymentDoc as any);
    const activateSubSpy = vi
      .spyOn(SubscriptionService, 'activateSubscription')
      .mockResolvedValue({ id: 'sub_123' } as any);

    const webhookPayload = {
      event: 'payment.completed',
      data: {
        payment: {
          id: 'gp_tx_999',
          reference,
          amount: 200,
          status: 'completed',
        },
      },
    };

    const response = await PaymentService.processWebhook(webhookPayload);

    expect(response.received).toBe(true);
    expect(response.status).toBe('SUCCESS');
    expect(mockPaymentDoc.status).toBe('SUCCESS');
    expect(activateSubSpy).toHaveBeenCalledWith(userId, paymentId, 200);
  });

  it('devrait garantir l’idempotence si le webhook est envoyé une seconde fois', async () => {
    const mockAlreadySuccessPayment = {
      reference,
      status: 'SUCCESS', // Déjà traité
    };

    vi.spyOn(PaymentModel, 'findOne').mockResolvedValue(mockAlreadySuccessPayment as any);
    const activateSubSpy = vi.spyOn(SubscriptionService, 'activateSubscription');

    const webhookPayload = {
      event: 'payment.completed',
      data: {
        payment: {
          id: 'gp_tx_999',
          reference,
          amount: 200,
          status: 'completed',
        },
      },
    };

    const response = await PaymentService.processWebhook(webhookPayload);

    expect(response.received).toBe(true);
    expect(response.status).toBe('ALREADY_PROCESSED');
    expect(activateSubSpy).not.toHaveBeenCalled();
  });
});

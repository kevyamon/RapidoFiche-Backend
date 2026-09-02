import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AnyZodObject } from 'zod';
import { AuthController } from '../controllers/auth.controller';
import { PedagogyController } from '../controllers/pedagogy.controller';
import { LessonController } from '../controllers/lesson.controller';
import { FavoriteHistoryController } from '../controllers/favorite-history.controller';
import { SubscriptionPaymentController } from '../controllers/subscription-payment.controller';
import { AdminManagementController } from '../controllers/admin-management.controller';
import { AdminOperationsController } from '../controllers/admin-operations.controller';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import {
  authLimiter,
  paymentLimiter,
  lessonAccessLimiter,
} from '../middlewares/rate-limiter.middleware';
import { ROLES } from '../constants/roles.constants';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
} from '../schemas/auth.schema';
import {
  createLessonSchema,
  updateLessonSchema,
  queryLessonsSchema,
} from '../schemas/lesson.schema';
import {
  initiatePaymentSchema,
  geniusPayWebhookSchema,
} from '../schemas/subscription-payment.schema';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // Max 25 Mo par fichier PDF
});

const validate =
  (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error);
    }
  };

export const apiRouter = Router();

// ==================== AUTHENTIFICATION ====================
apiRouter.post('/auth/register', authLimiter, validate(registerSchema), AuthController.register);
apiRouter.post('/auth/login', authLimiter, validate(loginSchema), AuthController.login);
apiRouter.post('/auth/google', authLimiter, validate(googleAuthSchema), AuthController.googleAuth);
apiRouter.post('/auth/refresh', AuthController.refresh);
apiRouter.post('/auth/logout', AuthController.logout);
apiRouter.get('/auth/me', authenticate, AuthController.getMe);

// ==================== RÉFÉRENTIEL PÉDAGOGIQUE ====================
apiRouter.get('/cycles', PedagogyController.getCycles);
apiRouter.get('/levels', PedagogyController.getLevels);
apiRouter.get('/levels/:id', PedagogyController.getLevelById);
apiRouter.get('/subjects', PedagogyController.getSubjects);
apiRouter.get('/domains', PedagogyController.getDomains);

// ==================== ESPACE ENSEIGNANT (/me) ====================
apiRouter.get('/me/subjects', authenticate, PedagogyController.getTeacherSubjects);
apiRouter.get('/me/favorites', authenticate, FavoriteHistoryController.getFavorites);
apiRouter.post('/me/favorites/:lessonId', authenticate, FavoriteHistoryController.addFavorite);
apiRouter.delete('/me/favorites/:lessonId', authenticate, FavoriteHistoryController.removeFavorite);
apiRouter.get('/me/history', authenticate, FavoriteHistoryController.getHistory);
apiRouter.get('/me/subscription', authenticate, SubscriptionPaymentController.getMySubscription);
apiRouter.get('/me/payments', authenticate, SubscriptionPaymentController.getMyPayments);

// ==================== FICHES PÉDAGOGIQUES ====================
apiRouter.get('/lessons', optionalAuth, validate(queryLessonsSchema), LessonController.getLessons);
apiRouter.get('/lessons/:id', optionalAuth, LessonController.getLessonById);
apiRouter.post('/lessons/:id/access', authenticate, lessonAccessLimiter, LessonController.requestAccess);
apiRouter.get('/lessons/:id/stream', LessonController.streamLessonPdf);

// ==================== PAIEMENTS ====================
apiRouter.post(
  '/payments/initiate',
  authenticate,
  paymentLimiter,
  validate(initiatePaymentSchema),
  SubscriptionPaymentController.initiatePayment
);
apiRouter.post(
  '/payments/webhook/:provider',
  validate(geniusPayWebhookSchema),
  SubscriptionPaymentController.handleWebhook
);

// ==================== ADMINISTRATION (ADMIN ONLY) ====================
const adminAuth = [authenticate, requireRole(ROLES.ADMIN)];

// Utilisateurs
apiRouter.get('/admin/users', adminAuth, AdminManagementController.getUsers);
apiRouter.get('/admin/users/:id', adminAuth, AdminManagementController.getUserById);
apiRouter.post('/admin/users/:id/suspend', adminAuth, AdminManagementController.suspendUser);
apiRouter.post('/admin/users/:id/reactivate', adminAuth, AdminManagementController.reactivateUser);
apiRouter.patch('/admin/users/:id/level', adminAuth, AdminManagementController.changeUserLevel);

// Fiches
apiRouter.post('/admin/lessons', adminAuth, validate(createLessonSchema), AdminManagementController.createLesson);
apiRouter.patch('/admin/lessons/:id', adminAuth, validate(updateLessonSchema), AdminManagementController.updateLesson);
apiRouter.post('/admin/lessons/:id/publish', adminAuth, AdminManagementController.publishLesson);
apiRouter.post('/admin/lessons/:id/unpublish', adminAuth, AdminManagementController.unpublishLesson);
apiRouter.delete('/admin/lessons/:id', adminAuth, AdminManagementController.archiveLesson);

// Importation Massive
apiRouter.post('/admin/imports', adminAuth, upload.array('files', 50), AdminOperationsController.uploadBatch);
apiRouter.get('/admin/imports/:id', adminAuth, AdminOperationsController.getBatchById);
apiRouter.post('/admin/imports/:id/confirm', adminAuth, AdminOperationsController.confirmBatch);

// Dashboard & Audit
apiRouter.get('/admin/dashboard', adminAuth, AdminOperationsController.getDashboardMetrics);
apiRouter.get('/admin/audit', adminAuth, AdminOperationsController.getAuditLogs);

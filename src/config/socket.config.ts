import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from './env.config';
import { verifyAccessToken } from '../utils/token.utils';
import { ROLES } from '../constants/roles.constants';
import { logger } from '../utils/logger.utils';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [env.FRONTEND_URL];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string) ||
        (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      if (token) {
        try {
          const payload = verifyAccessToken(token);
          socket.data.user = {
            id: payload.userId,
            role: payload.role,
            primaryLevelId: payload.primaryLevelId,
          };
        } catch {
          // Connexion anonyme autorisée mais non rattachée à une salle privée
        }
      }
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Erreur socket'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    if (user?.id) {
      const userRoom = `user:${user.id}`;
      socket.join(userRoom);

      const isAdmin =
        user.role === ROLES.SUPER_ADMIN ||
        user.role === ROLES.ADMIN ||
        user.role === ROLES.CONTENT_MANAGER;

      if (isAdmin) {
        socket.join('admin:dashboard');
      }
    }

    socket.on('join_admin_room', (adminToken?: string) => {
      try {
        const token = adminToken || (socket.handshake.auth?.token as string);
        if (token) {
          const payload = verifyAccessToken(token);
          if (
            payload.role === ROLES.SUPER_ADMIN ||
            payload.role === ROLES.ADMIN ||
            payload.role === ROLES.CONTENT_MANAGER
          ) {
            socket.join('admin:dashboard');
          }
        }
      } catch {
        // Ignorer
      }
    });
  });

  logger.info('SYSTEM', 'Serveur Socket.IO temps réel initialisé avec succès');
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToAdmin(event: string, data: unknown): void {
  if (!io) return;
  io.to('admin:dashboard').emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { AuthService } from '../src/services/auth.service';

vi.mock('../src/services/auth.service', () => ({
  AuthService: {
    register: vi.fn().mockResolvedValue({
      user: {
        id: 'user_123',
        firstName: 'Koffi',
        lastName: 'Yao',
        email: 'koffi.yao@rapidofiche.ci',
        role: 'TEACHER',
        status: 'ACTIVE',
      },
      tokens: {
        accessToken: 'mock_access_token_jwt',
        refreshToken: 'mock_refresh_token_jwt',
      },
    }),
    login: vi.fn().mockResolvedValue({
      user: {
        id: 'user_123',
        firstName: 'Koffi',
        lastName: 'Yao',
        email: 'koffi.yao@rapidofiche.ci',
        role: 'TEACHER',
        status: 'ACTIVE',
      },
      tokens: {
        accessToken: 'mock_access_token_jwt',
        refreshToken: 'mock_refresh_token_jwt',
      },
    }),
    refreshToken: vi.fn().mockResolvedValue({
      accessToken: 'new_mock_access_token_jwt',
      refreshToken: 'new_mock_refresh_token_jwt',
    }),
  },
}));

describe('Tests du Module d’Authentification (Auth)', () => {
  const app = createApp();

  it('devrait réussir l’inscription d’un enseignant avec des données valides', async () => {
    const validRegistrationData = {
      firstName: 'Koffi',
      lastName: 'Yao',
      email: 'koffi.yao@rapidofiche.ci',
      password: 'Password123!',
      phone: '+225 0707070707',
      primaryLevelId: '507f1f77bcf86cd799439011',
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistrationData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('koffi.yao@rapidofiche.ci');
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('devrait rejeter l’inscription si le mot de passe ne respecte pas les critères de sécurité', async () => {
    const invalidPasswordData = {
      firstName: 'Koffi',
      lastName: 'Yao',
      email: 'koffi.invalide@rapidofiche.ci',
      password: 'court', // Trop court, pas de majuscule ni chiffre
      primaryLevelId: '507f1f77bcf86cd799439011',
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(invalidPasswordData);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devrait réussir la connexion avec des identifiants valides', async () => {
    const loginData = {
      email: 'koffi.yao@rapidofiche.ci',
      password: 'Password123!',
    };

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBe('mock_access_token_jwt');
  });

  it('devrait déconnecter l’utilisateur et révoquer le cookie de rafraîchissement', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

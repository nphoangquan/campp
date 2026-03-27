import request from 'supertest';
import app from '../../../src/app';

describe('GET /api/auth/me', () => {
  it('should return 401 when authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication token required' });
  });

  it('should return 401 when bearer token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });
});

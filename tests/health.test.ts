import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Check & Error Handling API', () => {
  const app = createApp();

  it('GET /api/v1/health should return 200 with standard success envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'healthy');
    expect(res.body.data).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('requestId');
    expect(res.body.meta).toHaveProperty('timestamp');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('should preserve incoming X-Request-Id in response header and meta', async () => {
    const customRequestId = 'test-request-id-12345';
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', customRequestId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customRequestId);
    expect(res.body.meta.requestId).toBe(customRequestId);
  });

  it('GET /api/v1/non-existent-route should return 404 with standard error envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('requestId');
  });

  it('GET / should serve the MeetFlow frontend Single Page Application', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('MeetFlow');
    expect(res.text).toContain('id="modal-create-meeting"');
    expect(res.text).toContain('id="modal-conflict-warning"');
    expect(res.text).toContain('id="modal-confirm-discard"');
  });

  it('GET /css/app.css should serve the Design System stylesheet', async () => {
    const res = await request(app).get('/css/app.css');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.text).toContain('--primary-gradient');
  });
});


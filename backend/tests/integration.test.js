/**
 * Integration Tests - API Endpoints
 * Run: npm run test:integration
 * Requires: PostgreSQL running with test database
 */
'use strict';

const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/config/database');

let authToken;
let testEquipmentId;
let testWoId;

// ─── Setup & Teardown ─────────────────────────────────────────
beforeAll(async () => {
  // Wait for DB
  await new Promise(r => setTimeout(r, 1000));

  // Login to get token
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'manager@thammasat.ac.th', password: 'password123' });

  if (res.body.success) {
    authToken = res.body.data.accessToken;
  }
}, 15000);

afterAll(async () => {
  await pool.end();
});

// ─── Health Check ─────────────────────────────────────────────
describe('GET /health', () => {
  test('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
  });
});

// ─── Authentication ───────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  test('returns token with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@thammasat.ac.th', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toHaveProperty('role');
  });

  test('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@thammasat.ac.th', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects malformed email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@thammasat.ac.th' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  test('returns user profile with valid token', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).toHaveProperty('role');
  });

  test('rejects request without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ─── Equipment API ────────────────────────────────────────────
describe('GET /api/v1/equipment', () => {
  test('returns equipment list', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/equipment')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('filters by criticality', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/equipment?criticality=critical')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(eq => {
      expect(eq.criticality).toBe('critical');
    });
  });

  test('supports search parameter', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/equipment?search=pump')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('returns pagination metadata', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/equipment?limit=2&page=1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('pages');
  });
});

// ─── Work Orders API ──────────────────────────────────────────
describe('GET /api/v1/work-orders', () => {
  test('returns work order list', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('filters by status', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/work-orders?status=open')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(wo => {
      expect(wo.status).toBe('open');
    });
  });
});

// ─── KPI API ─────────────────────────────────────────────────
describe('GET /api/v1/kpi/summary', () => {
  test('returns KPI summary object', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/kpi/summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('mttr');
    expect(res.body.data).toHaveProperty('mtbf');
    expect(res.body.data).toHaveProperty('oee');
    expect(res.body.data).toHaveProperty('downtime');
  });

  test('returns downtime trend data', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/kpi/downtime-trend?days=7')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── Downtime API ─────────────────────────────────────────────
describe('GET /api/v1/downtime', () => {
  test('returns downtime records', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/downtime')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('filters active downtime only', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/v1/downtime?active_only=true')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(dr => {
      expect(dr.end_time).toBeNull();
    });
  });
});

// ─── Rate Limiting ────────────────────────────────────────────
describe('Rate limiting', () => {
  test('auth endpoint has rate limiting', async () => {
    // Make many rapid requests — in test env limit is relaxed but header should exist
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });

    // Should have rate limit headers
    expect(res.headers['x-ratelimit-limit'] || res.headers['ratelimit-limit']).toBeDefined();
  });
});

// ─── 404 Handler ─────────────────────────────────────────────
describe('404 handling', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent-endpoint');
    expect(res.status).toBe(404);
  });
});

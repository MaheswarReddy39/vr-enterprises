import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('API without a database connection', () => {
  it('GET /api/v1 returns API info', async () => {
    const res = await request(app).get('/api/v1');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'VR Enterprises API');
  });

  it('GET /api/v1/health reports liveness and dependency status', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.services.database, 'disconnected');
    assert.equal(res.body.services.imageStorage, 'gridfs');
    assert.equal(typeof res.body.uptimeSeconds, 'number');
  });

  it('GET /api/v1/health never leaks configuration values', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.doesNotMatch(JSON.stringify(res.body), /mongodb|secret|api_key/i);
  });

  it('GET /api/v1/health/ready returns 503 until the database is connected', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'not_ready');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('returns a JSON 400 for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Malformed JSON/);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('only allows the configured CORS origin', async () => {
    const allowed = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
    const blocked = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
  });
});

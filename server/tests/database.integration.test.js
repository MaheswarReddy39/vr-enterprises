// Runs against a real MongoDB only when TEST_MONGODB_URI is set (e.g. local mongod or an Atlas dev
// cluster). Everything happens in a throwaway database that is dropped afterwards.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { createFirstAdmin } from '../src/services/adminSetup.service.js';

const uri = process.env.TEST_MONGODB_URI;
const PASSWORD = 'Str0ng!Passw0rd';

describe('database integration', { skip: !uri && 'TEST_MONGODB_URI is not set' }, () => {
  before(async () => {
    await connectDB(uri, { dbName: `vr_test_${Date.now()}` });
    await User.init();
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  });

  it('health/ready returns 200 when connected', async () => {
    const res = await request(createApp()).get('/api/v1/health/ready');
    assert.equal(res.status, 200);
    assert.equal(res.body.services.database, 'connected');
  });

  it('createFirstAdmin stores a hashed password and a lowercase email', async () => {
    const admin = await createFirstAdmin({ name: 'Test Admin', email: 'Admin@Example.com', password: PASSWORD });
    assert.equal(admin.role, 'admin');
    assert.equal(admin.email, 'admin@example.com');
    assert.equal(admin.toJSON().passwordHash, undefined);

    const stored = await User.findById(admin._id).select('+passwordHash');
    assert.notEqual(stored.passwordHash, PASSWORD);
  });

  it('createFirstAdmin refuses once an admin exists', async () => {
    await assert.rejects(
      createFirstAdmin({ name: 'Second Admin', email: 'second@example.com', password: PASSWORD }),
      /administrator already exists/,
    );
  });

  it('createFirstAdmin rejects weak passwords before touching the database', async () => {
    await User.deleteMany({});
    await assert.rejects(
      createFirstAdmin({ name: 'Test Admin', email: 'weak@example.com', password: 'weak' }),
      /at least 10 characters/,
    );
    assert.equal(await User.countDocuments(), 0);
  });
});

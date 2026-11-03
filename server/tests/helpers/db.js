import mongoose from 'mongoose';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.js';
import { hashPassword } from '../../src/utils/password.js';

// Integration tests run against any MongoDB (a plain local mongod or Atlas) and use a throwaway database.
export const mongoUri = process.env.TEST_MONGODB_URI;
export const skipReason = !mongoUri && 'TEST_MONGODB_URI is not set';
export const PASSWORD = 'Str0ng!Passw0rd';

let passwordHash;

export async function setupDb() {
  await connectDB(mongoUri, { dbName: `vr_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}` });
  // Build indexes up front so unique-index behaviour is the same from the first request.
  await Promise.all(Object.values(mongoose.models).map(async (m) => {
    await m.init();
    await m.createCollection().catch(() => {});
  }));
  passwordHash = await hashPassword(PASSWORD);
  return createApp();
}

export async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
}

export async function createUser({ role = 'admin', email, isActive = true } = {}) {
  return User.create({
    name: `Test ${role}`,
    email: email ?? `${role}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash,
    role,
    isActive,
  });
}

/** Logs in through the real endpoint and returns the access token plus the refresh cookie. */
export async function login(app, email, password = PASSWORD) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return {
    res,
    token: res.body.accessToken,
    cookie: (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]),
  };
}

export async function adminSession(app, role = 'admin') {
  const user = await createUser({ role });
  const { token } = await login(app, user.email);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

const solid = (width, height, color) => ({ create: { width, height, channels: 3, background: color } });

/** Real, decodable images (generated with sharp), plus deliberately broken files for negative tests. */
export const fixtures = {
  jpeg: (color = '#c33', w = 200, h = 120) => sharp(solid(w, h, color)).jpeg().toBuffer(),
  png: (color = '#3a3', w = 200, h = 120) => sharp(solid(w, h, color)).png().toBuffer(),
  webp: (color = '#33c', w = 200, h = 120) => sharp(solid(w, h, color)).webp().toBuffer(),
  hugeCanvas: (w = 3000, h = 2000) => sharp(solid(w, h, '#888')).jpeg().toBuffer(),
  /** Valid JPEG magic bytes followed by garbage: passes the signature check, fails real decoding. */
  corruptJpeg: () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]),
  notAnImage: () => Buffer.from('<?php echo "hi"; ?> this is plain text, not an image at all'),
};

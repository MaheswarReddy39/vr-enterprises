import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function dbState() {
  return STATES[mongoose.connection.readyState] ?? 'unknown';
}

export async function connectDB(uri = env.MONGODB_URI, options = {}) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to server/.env (see server/.env.example).');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    ...options,
  });

  const { host, name } = mongoose.connection;
  // Host and database name only: never the user name, password or the connection string.
  const where = /\.mongodb\.net$/i.test(host) ? 'MongoDB Atlas' : /^(localhost|127\.|\[?::1)/i.test(host) ? 'LOCAL MongoDB on this computer' : 'remote MongoDB';
  console.log(`MongoDB connected: ${where} (host: ${host}, database: ${name})`);
  if (env.isProduction && where.startsWith('LOCAL')) console.warn('WARNING: production is connected to a LOCAL MongoDB. Check MONGODB_URI.');
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});
mongoose.connection.on('disconnected', () => {
  if (!env.isTest) console.warn('MongoDB disconnected');
});

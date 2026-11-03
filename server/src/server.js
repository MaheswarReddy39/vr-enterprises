import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { recoverBookings } from './services/booking.service.js';
import { env } from './config/env.js';

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.');
    process.exit(1);
  }
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    console.error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required (32+ characters, different from each other).\n' +
        "Generate each with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
    process.exit(1);
  }

  await connectDB();
  const server = createApp().listen(env.PORT, () => {
    // The server listens on every network interface (what a host such as Render needs), not only on localhost.
    console.log(`API listening on port ${env.PORT} (NODE_ENV=${env.NODE_ENV})`);
    // Render sets RENDER=true. A hosted service that is not in production mode has insecure cookies and verbose errors.
    if (process.env.RENDER && !env.isProduction) {
      console.warn('WARNING: this is running on Render but NODE_ENV is "' + env.NODE_ENV + '", not "production". In the Render dashboard (Environment) set NODE_ENV=production and remove any PORT you added, then redeploy.');
    }
  });

  // Crash recovery: roll back any booking confirmation that was interrupted (see booking.service.js), now and every 5 minutes.
  const recover = () => recoverBookings().catch((e) => console.error('Booking recovery failed:', e.message));
  await recover();
  setInterval(recover, 5 * 60 * 1000).unref();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});

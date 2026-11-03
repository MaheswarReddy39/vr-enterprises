import { dbState } from '../config/db.js';
import { env } from '../config/env.js';


const snapshot = () => ({
  service: 'vr-enterprises-api',
  environment: env.NODE_ENV,
  uptimeSeconds: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
  services: {
    database: dbState(),
    imageStorage: 'gridfs',
  },
});

/** Liveness: the process is up. Always 200; reports dependency status for humans and dashboards. */
export function liveness(_req, res) {
  res.json({ status: 'ok', ...snapshot() });
}

/** Readiness: 503 until the database is connected (use for load balancer checks). */
export function readiness(_req, res) {
  const data = snapshot();
  const ready = data.services.database === 'connected';
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', ...data });
}

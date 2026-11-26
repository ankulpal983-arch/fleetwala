import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const PRODUCTION_DEFAULT_ORIGINS = [
  "https://fleetwala.app",
  "https://www.fleetwala.app",
];

const DEV_DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...PRODUCTION_DEFAULT_ORIGINS,
];

export function resolveAllowedOrigins(
  rawCorsOrigin = process.env.CORS_ORIGIN,
  nodeEnv = process.env.NODE_ENV,
): string[] {
  if (rawCorsOrigin && rawCorsOrigin.trim().length > 0) {
    return rawCorsOrigin
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean);
  }
  return nodeEnv === "production" ? PRODUCTION_DEFAULT_ORIGINS : DEV_DEFAULT_ORIGINS;
}

export function isOriginAllowed(origin: string | undefined, allowlist: string[]): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, "");
  return allowlist.includes(normalized);
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = Number(process.env.API_RATE_LIMIT_PER_MIN) || 120;

export function createApiApp(): Express {
  const app: Express = express();
  const allowedOrigins = resolveAllowedOrigins();
  const hits = new Map<string, { count: number; resetAt: number }>();

  const pruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, RATE_WINDOW_MS);
  pruneTimer.unref();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    next();
  });

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
        } else {
          const err = new Error("CORS origin denied") as Error & { statusCode?: number };
          err.statusCode = 403;
          callback(err, false);
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const existing = hits.get(ip);
    if (!existing || existing.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      next();
      return;
    }
    existing.count += 1;
    if (existing.count > RATE_MAX_REQUESTS) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }
    next();
  });

  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  app.use("/api", router);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode || err.status || 500;
    if (status >= 500) {
      logger.error({ err }, "Unhandled API error");
    }
    res.status(status).json({
      error: status === 403 ? "Origin not allowed" : status >= 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}

const app: Express = createApiApp();

export default app;

import app, { resolveAllowedOrigins } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  logger.error({ rawPort }, "Invalid PORT environment variable");
  process.exit(1);
}

if (process.env["NODE_ENV"] === "production" && !process.env["CORS_ORIGIN"]) {
  logger.warn("CORS_ORIGIN is not set in production; using strict https://fleetwala.app allowlist");
}

const server = app.listen(port, "0.0.0.0", () => {
  logger.info(
    { port, host: "0.0.0.0", allowedOrigins: resolveAllowedOrigins(), nodeEnv: process.env["NODE_ENV"] || "development" },
    "Server listening",
  );
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error while closing HTTP server");
      process.exit(1);
    }
    logger.info("HTTP server closed cleanly");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after 10s drain timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

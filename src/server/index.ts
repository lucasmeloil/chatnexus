import { loadEnvConfig } from "@next/env";
// Load environment variables before any other imports/logic
loadEnvConfig(process.cwd());

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { setupSocket } from "./socket";
import { waManager } from "../modules/whatsapp/manager";
import { logger } from "../lib/logger";
import pkg from "../../package.json";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3030", 10);

if (!process.env.AUTH_SECRET) {
  logger.error("Server", "AUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
  process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      if (!req.url) return;
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error("Server", "Error handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(server, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  setupSocket(io);
  // Optional: Global instance for Baileys to emit events
  (global as any).io = io;

  // Initialize WhatsApp Manager
  waManager.setup(io);
  waManager.loadSessions();

  // Start Scheduler
  import("../modules/whatsapp/scheduler").then(m => m.startScheduler());

  // Ensure Master Admin privileges for lucasmeloil@pm.me & disable public registration
  import("../lib/prisma").then(async ({ prisma }) => {
    try {
      await prisma.user.updateMany({
        where: { email: "lucasmeloil@pm.me" },
        data: { role: "SUPERADMIN" }
      });
      await prisma.systemConfig.upsert({
        where: { id: "default" },
        create: { id: "default", enableRegistration: false },
        update: { enableRegistration: false }
      });
      logger.info("Auth", "Master Admin verified and public registration disabled");
    } catch (e) {
      logger.error("Auth", "Failed to verify master admin / system config", e);
    }
  });

  // Cloudflare 520 Fix: increase keep-alive timeout so Node doesn't kill idle connections that Cloudflare expects to reuse
  // See: https://github.com/vercel/next.js/issues/48962
  server.keepAliveTimeout = 120 * 1000; // 120 seconds
  server.headersTimeout = 120 * 1000; // 120 seconds

  server.listen(port, () => {
    logger.banner(pkg.name.toUpperCase(), pkg.version, port);
  });

  // Graceful shutdown handling for clean Baileys socket closure on process restart/stop
  const handleGracefulShutdown = async (signal: string) => {
    logger.info("Server", `${signal} received. Closing all WhatsApp sessions gracefully...`);
    try {
      await waManager.shutdownAll();
    } catch (e) {
      logger.error("Server", "Error closing WhatsApp sessions:", e);
    }
    server.close(() => {
      logger.info("Server", "HTTP server closed.");
      process.exit(0);
    });
    // Fallback force exit if lingering handles remain
    setTimeout(() => {
      process.exit(0);
    }, 4000);
  };

  process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
});

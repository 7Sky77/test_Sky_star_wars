import path from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { syncAdminUsers } from "./adminAuth.js";
import type { CatalogRef } from "./catalogStore.js";
import { loadCatalog } from "./catalog.js";
import { backfillPlanetParams, backfillPlanetTypes, openDatabase } from "./db.js";
import { registerRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-change-me";
const DATABASE_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), "data", "game.db");

async function main() {
  const catalog = await loadCatalog();
  const catalogRef: CatalogRef = { current: catalog };
  const db = openDatabase(DATABASE_PATH);
  const maxPlanetSlot = catalogRef.current.world.maxPlanetSlot;
  backfillPlanetParams(db, maxPlanetSlot);
  backfillPlanetTypes(db, catalogRef.current.planetTypes.map((t) => t.id), maxPlanetSlot);

  const adminUsernames = (process.env.ADMIN_USERNAMES ?? "Sky")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  syncAdminUsers(db, adminUsernames);

  const adminEnabled =
    process.env.ADMIN_PANEL === "1" ||
    process.env.NODE_ENV !== "production";

  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: [
      "http://localhost:5175",
      "http://127.0.0.1:5175",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  });

  const cheatsEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_RESOURCE_CHEAT === "1";

  registerRoutes(app, db, catalogRef, JWT_SECRET, cheatsEnabled, {
    adminEnabled,
    adminUsernames,
  });

  if (cheatsEnabled) {
    app.log.info("Dev cheats: POST /api/game/dev/grant-resources enabled");
  }
  if (adminEnabled) {
    app.log.info(
      { admins: adminUsernames },
      "Admin panel: /api/admin/* (users in ADMIN_USERNAMES)"
    );
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

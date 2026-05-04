import path from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadCatalog } from "./catalog.js";
import { openDatabase } from "./db.js";
import { registerRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-change-me";
const DATABASE_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), "data", "game.db");

async function main() {
  const catalog = await loadCatalog();
  const db = openDatabase(DATABASE_PATH);

  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  });

  registerRoutes(app, db, catalog, JWT_SECRET);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import {
  catalogSectionItems,
  patchCatalogItem,
  type CatalogRef,
  type CatalogSection,
} from "./catalogStore.js";
import { requireAdmin } from "./adminAuth.js";
import { listGameLogs, logGameEvent } from "./gameLog.js";

const SECTIONS: CatalogSection[] = [
  "buildings",
  "units",
  "defense",
  "research",
  "planetTypes",
];

function isCatalogSection(s: string): s is CatalogSection {
  return (SECTIONS as string[]).includes(s);
}

export function registerAdminRoutes(
  app: FastifyInstance,
  db: Database.Database,
  catalogRef: CatalogRef,
  jwtSecret: string,
  adminEnabled: boolean
): void {
  if (!adminEnabled) return;

  app.get("/api/admin/status", (req, rep) => {
    const userId = requireAdmin(req, rep, jwtSecret, db);
    if (userId == null) return;
    return rep.send({ ok: true, sections: SECTIONS });
  });

  app.get<{ Querystring: { limit?: string; kind?: string; offset?: string } }>(
    "/api/admin/logs",
    (req, rep) => {
      const userId = requireAdmin(req, rep, jwtSecret, db);
      if (userId == null) return;

      const rows = listGameLogs(db, {
        limit: Number(req.query.limit ?? 100),
        kind: req.query.kind?.trim() || undefined,
        offset: Number(req.query.offset ?? 0),
      });

      return rep.send({
        logs: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          userId: r.user_id,
          username: r.username,
          planetId: r.planet_id,
          message: r.message,
          details: r.details_json ? JSON.parse(r.details_json) : null,
          createdAt: r.created_at,
        })),
      });
    }
  );

  app.get<{ Params: { section: string } }>(
    "/api/admin/catalog/:section",
    (req, rep) => {
      const userId = requireAdmin(req, rep, jwtSecret, db);
      if (userId == null) return;
      const section = req.params.section;
      if (!isCatalogSection(section)) {
        return rep.code(400).send({ error: "invalid_section" });
      }
      return rep.send({
        section,
        items: catalogSectionItems(catalogRef.current, section),
      });
    }
  );

  app.patch<{
    Params: { section: string; id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/catalog/:section/:id", async (req, rep) => {
    const userId = requireAdmin(req, rep, jwtSecret, db);
    if (userId == null) return;

    const section = req.params.section;
    if (!isCatalogSection(section)) {
      return rep.code(400).send({ error: "invalid_section" });
    }

    const patch = req.body ?? {};
    if (typeof patch !== "object" || Array.isArray(patch)) {
      return rep.code(400).send({ error: "invalid_body" });
    }
    if ("id" in patch && patch.id !== req.params.id) {
      return rep.code(400).send({ error: "id_mismatch" });
    }

    try {
      const updated = await patchCatalogItem(
        catalogRef,
        section,
        req.params.id,
        patch
      );
      logGameEvent(db, {
        kind: "admin.catalog_edit",
        userId,
        message: `Изменён каталог ${section}/${req.params.id}`,
        details: { section, id: req.params.id, patch },
      });
      return rep.send({ ok: true, item: updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      if (msg === "not_found") return rep.code(404).send({ error: "not_found" });
      return rep.code(400).send({ error: "validation_failed", detail: msg });
    }
  });
}

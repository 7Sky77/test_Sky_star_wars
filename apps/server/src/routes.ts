import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import type { GameCatalog } from "@sw/shared";
import { getBearerToken, signUserToken, verifyUserToken } from "./auth.js";
import { advancePlanet, grantResources, pickStartingCoords, purchaseDefenseUnit, purchaseFleetUnit, queueBuild } from "./engine.js";

function requireUser(
  req: FastifyRequest,
  rep: FastifyReply,
  secret: string
): number | null {
  const t = getBearerToken(req);
  if (!t) {
    rep.code(401).send({ error: "unauthorized" });
    return null;
  }
  const v = verifyUserToken(t, secret);
  if (!v) {
    rep.code(401).send({ error: "invalid_token" });
    return null;
  }
  return v.userId;
}

export function registerRoutes(
  app: FastifyInstance,
  db: Database.Database,
  catalog: GameCatalog,
  jwtSecret: string,
  cheatsEnabled: boolean
) {
  const defaultFaction = catalog.factions[0]?.id ?? "terran";

  app.get("/api/catalog", async (_req, rep) => {
    rep.send({
      world: catalog.world,
      resources: catalog.resources,
      factions: catalog.factions,
      buildings: catalog.buildings,
      units: catalog.units,
      research: catalog.research,
      defense: catalog.defense,
      cheats: cheatsEnabled ? { grantResources: true } : undefined,
    });
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    "/auth/register",
    async (req, rep) => {
      const username = req.body?.username?.trim();
      const password = req.body?.password;
      if (!username || username.length < 2) {
        return rep.code(400).send({ error: "invalid_username" });
      }
      if (!password || password.length < 4) {
        return rep.code(400).send({ error: "invalid_password" });
      }
      const hash = bcrypt.hashSync(password, 10);
      const now = Date.now();
      try {
        const tx = db.transaction(() => {
          const r = db
            .prepare(
              `INSERT INTO users (username, password_hash, faction_id, created_at) VALUES (?, ?, ?, ?)`
            )
            .run(username, hash, defaultFaction, now);
          const userId = Number(r.lastInsertRowid);
          const coords = pickStartingCoords(db);
          const pr = db
            .prepare(
              `INSERT INTO planets (user_id, name, arm, system, position, last_processed_at, metal, crystal, deuterium) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              userId,
              "Колония",
              coords.arm,
              coords.system,
              coords.position,
              now,
              800,
              400,
              200
            );
          const planetId = Number(pr.lastInsertRowid);
          const insB = db.prepare(
            `INSERT INTO planet_buildings (planet_id, building_id, level) VALUES (?, ?, ?)`
          );
          insB.run(planetId, "metal_mine", 1);
          insB.run(planetId, "solar_plant", 1);
        });
        tx();
      } catch (e: unknown) {
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
          return rep.code(409).send({ error: "username_taken" });
        }
        throw e;
      }
      const row = db
        .prepare(`SELECT id FROM users WHERE username = ?`)
        .get(username) as { id: number };
      const token = signUserToken(row.id, jwtSecret);
      return rep.send({
        token,
        user: { id: row.id, username, factionId: defaultFaction },
      });
    }
  );

  app.post<{ Body: { username?: string; password?: string } }>(
    "/auth/login",
    async (req, rep) => {
      const username = req.body?.username?.trim();
      const password = req.body?.password;
      if (!username || !password) {
        return rep.code(400).send({ error: "invalid_credentials" });
      }
      const row = db
        .prepare(
          `SELECT id, password_hash, faction_id FROM users WHERE username = ?`
        )
        .get(username) as
        | { id: number; password_hash: string; faction_id: string }
        | undefined;
      if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return rep.code(401).send({ error: "invalid_credentials" });
      }
      const token = signUserToken(row.id, jwtSecret);
      return rep.send({
        token,
        user: { id: row.id, username, factionId: row.faction_id },
      });
    }
  );

  app.get("/api/game/state", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const planet = db
      .prepare(
        `SELECT id, name, arm, system, position, metal, crystal, deuterium, last_processed_at FROM planets WHERE user_id = ? LIMIT 1`
      )
      .get(userId) as
      | {
          id: number;
          name: string;
          arm: number;
          system: number;
          position: number;
          metal: number;
          crystal: number;
          deuterium: number;
          last_processed_at: number;
        }
      | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    advancePlanet(db, catalog, planet.id, now);

    const p2 = db
      .prepare(
        `SELECT id, name, arm, system, position, metal, crystal, deuterium FROM planets WHERE id = ?`
      )
      .get(planet.id) as typeof planet;

    const buildings = db
      .prepare(
        `SELECT building_id, level FROM planet_buildings WHERE planet_id = ?`
      )
      .all(planet.id) as { building_id: string; level: number }[];

    const queue = db
      .prepare(
        `SELECT id, building_id, target_level, started_at, finishes_at FROM build_queue WHERE planet_id = ? ORDER BY id ASC`
      )
      .all(planet.id) as {
      id: number;
      building_id: string;
      target_level: number;
      started_at: number;
      finishes_at: number;
    }[];

    const userRow = db
      .prepare(`SELECT username, faction_id FROM users WHERE id = ?`)
      .get(userId) as { username: string; faction_id: string };

    const units = db
      .prepare(`SELECT unit_id, quantity FROM planet_units WHERE planet_id = ?`)
      .all(planet.id) as { unit_id: string; quantity: number }[];

    const defenseRows = db
      .prepare(`SELECT defense_id, quantity FROM planet_defense WHERE planet_id = ?`)
      .all(planet.id) as { defense_id: string; quantity: number }[];

    return rep.send({
      serverTime: now,
      user: {
        username: userRow.username,
        factionId: userRow.faction_id,
      },
      planet: {
        id: p2.id,
        name: p2.name,
        arm: p2.arm,
        system: p2.system,
        position: p2.position,
        resources: {
          metal: p2.metal,
          crystal: p2.crystal,
          deuterium: p2.deuterium,
        },
      },
      buildings,
      buildQueue: queue,
      units,
      defense: defenseRows,
    });
  });

  app.post<{ Body: { buildingId?: string } }>("/api/game/build", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const buildingId = req.body?.buildingId;
    if (!buildingId) return rep.code(400).send({ error: "missing_buildingId" });

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    advancePlanet(db, catalog, planet.id, now);
    const r = queueBuild(db, catalog, planet.id, buildingId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });
    return rep.send({ ok: true });
  });

  app.post<{ Body: { unitId?: string } }>("/api/game/ships/build", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const unitId = req.body?.unitId?.trim();
    if (!unitId) return rep.code(400).send({ error: "missing_unitId" });

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    const r = purchaseFleetUnit(db, catalog, planet.id, unitId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });
    return rep.send({ ok: true });
  });

  app.post<{ Body: { defenseId?: string } }>("/api/game/defense/build", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const defenseId = req.body?.defenseId?.trim();
    if (!defenseId) return rep.code(400).send({ error: "missing_defenseId" });

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    const r = purchaseDefenseUnit(db, catalog, planet.id, defenseId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });
    return rep.send({ ok: true });
  });

  app.get<{ Querystring: { arm?: string; system?: string } }>(
    "/api/galaxy/system",
    (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;

      const w = catalog.world;
      let arm = Number(req.query.arm ?? w.minArm);
      let system = Number(req.query.system ?? w.minSystem);
      arm = Math.min(w.maxArm, Math.max(w.minArm, arm));
      system = Math.min(w.maxSystem, Math.max(w.minSystem, system));

      const rows = db
        .prepare(
          `SELECT p.position, p.name AS planet_name, p.user_id, u.username
           FROM planets p JOIN users u ON u.id = p.user_id
           WHERE p.arm = ? AND p.system = ? AND p.position >= 1 AND p.position <= ?
           ORDER BY p.position`
        )
        .all(arm, system, w.maxPlanetSlot) as {
        position: number;
        planet_name: string;
        user_id: number;
        username: string;
      }[];

      const byPos = new Map<number, (typeof rows)[0]>();
      for (const r of rows) byPos.set(r.position, r);

      const slots: {
        position: number;
        kind: "star" | "planet";
        label: string;
        ownerUsername?: string;
        planetName?: string;
        isYours?: boolean;
      }[] = [];

      slots.push({
        position: w.starSlot,
        kind: "star",
        label: "Звезда",
      });

      for (let pos = 1; pos <= w.maxPlanetSlot; pos++) {
        const hit = byPos.get(pos);
        if (hit) {
          slots.push({
            position: pos,
            kind: "planet",
            label: `${arm}:${system}:${pos}`,
            ownerUsername: hit.username,
            planetName: hit.planet_name,
            isYours: hit.user_id === userId,
          });
        } else {
          slots.push({
            position: pos,
            kind: "planet",
            label: `${arm}:${system}:${pos}`,
          });
        }
      }

      return rep.send({ arm, system, slots });
    }
  );

  if (cheatsEnabled) {
    app.post<{
      Body: { metal?: unknown; crystal?: unknown; deuterium?: unknown };
    }>("/api/game/dev/grant-resources", (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;

      const parse = (v: unknown): number => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.floor(n);
      };
      const metal = parse(req.body?.metal);
      const crystal = parse(req.body?.crystal);
      const deuterium = parse(req.body?.deuterium);
      if (metal === 0 && crystal === 0 && deuterium === 0) {
        return rep.code(400).send({ error: "nothing_to_grant" });
      }

      const planet = db
        .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
        .get(userId) as { id: number } | undefined;
      if (!planet) return rep.code(404).send({ error: "no_planet" });

      const r = grantResources(db, catalog, planet.id, { metal, crystal, deuterium }, Date.now());
      if (!r.ok) return rep.code(400).send({ error: r.error });
      return rep.send({ ok: true });
    });
  }
}

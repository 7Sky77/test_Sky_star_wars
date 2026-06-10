import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import { planetParamsForCoords, planetTypeForCoords } from "@sw/shared";
import { isAdminUsername } from "./adminAuth.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { refreshCatalogIfDev, type CatalogRef } from "./catalogStore.js";
import { getBearerToken, signUserToken, verifyUserToken } from "./auth.js";
import {
  advancePlanet,
  advanceResearch,
  grantResources,
  pickStartingCoords,
  purchaseDefenseUnit,
  purchaseFleetUnit,
  queueBuild,
  queueResearch,
} from "./engine.js";
import { buildGalaxySector, buildSystemSlots } from "./galaxy.js";
import {
  advanceFleetMissions,
  listFleetMissions,
  recallFleetMission,
  sendFleetMission,
  serializeFleetMission,
} from "./fleet.js";
import {
  attackIntruderFromMission,
  listBattleReports,
  serializeBattleReport,
} from "./combat.js";
import {
  ensureSystemPirate,
  listOrbitIntruders,
  serializeOrbitIntruder,
} from "./intruders.js";
import { logGameEvent } from "./gameLog.js";

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

export interface RegisterRoutesOpts {
  adminEnabled: boolean;
  adminUsernames: string[];
}

export function registerRoutes(
  app: FastifyInstance,
  db: Database.Database,
  catalogRef: CatalogRef,
  jwtSecret: string,
  cheatsEnabled: boolean,
  opts: RegisterRoutesOpts
) {
  const cat = () => catalogRef.current;
  const defaultFaction = cat().factions[0]?.id ?? "terran";

  app.get("/api/catalog", async (_req, rep) => {
    await refreshCatalogIfDev(catalogRef);
    const c = cat();
    rep.send({
      world: c.world,
      resources: c.resources,
      factions: c.factions,
      buildings: c.buildings,
      units: c.units,
      research: c.research,
      defense: c.defense,
      planetTypes: c.planetTypes,
      localSpace: c.localSpace,
      unires: c.unires,
      orbitIntruders: listOrbitIntruders(db).map((i) => serializeOrbitIntruder(i, c)),
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
      const isAdmin = isAdminUsername(username, opts.adminUsernames) ? 1 : 0;
      let newUserId = 0;
      let planetId = 0;
      let coords = { arm: 0, system: 0, position: 0 };
      try {
        const tx = db.transaction(() => {
          const r = db
            .prepare(
              `INSERT INTO users (username, password_hash, faction_id, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`
            )
            .run(username, hash, defaultFaction, isAdmin, now);
          newUserId = Number(r.lastInsertRowid);
          coords = pickStartingCoords(db);
          const planetTypeId = planetTypeForCoords(
            coords.arm,
            coords.system,
            coords.position,
            cat().planetTypes.map((t) => t.id),
            cat().world.maxPlanetSlot
          );
          const planetParams = planetParamsForCoords(
            coords.arm,
            coords.system,
            coords.position,
            cat().world.maxPlanetSlot
          );
          const pr = db
            .prepare(
              `INSERT INTO planets (user_id, name, arm, system, position, last_processed_at, metal, minerals, vespene, planet_type_id, diameter_km, temperature_min, temperature_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              newUserId,
              "Колония",
              coords.arm,
              coords.system,
              coords.position,
              now,
              800,
              400,
              200,
              planetTypeId,
              planetParams.diameterKm,
              planetParams.temperatureMin,
              planetParams.temperatureMax
            );
          planetId = Number(pr.lastInsertRowid);
          const insB = db.prepare(
            `INSERT INTO planet_buildings (planet_id, building_id, level) VALUES (?, ?, ?)`
          );
          insB.run(planetId, "metal_mine", 1);
          insB.run(planetId, "solar_plant", 1);
          ensureSystemPirate(db, coords.arm, coords.system, coords.position);
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

      logGameEvent(db, {
        kind: "auth.register",
        userId: newUserId,
        username,
        planetId,
        message: `Регистрация: ${username} → [${coords.arm}:${coords.system}:${coords.position}]`,
        details: { coords, isAdmin: isAdmin === 1 },
      });

      const token = signUserToken(newUserId, jwtSecret);
      return rep.send({
        token,
        user: {
          id: newUserId,
          username,
          factionId: defaultFaction,
          isAdmin: isAdmin === 1,
        },
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
          `SELECT id, password_hash, faction_id, is_admin FROM users WHERE username = ?`
        )
        .get(username) as
        | {
            id: number;
            password_hash: string;
            faction_id: string;
            is_admin: number;
          }
        | undefined;
      if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return rep.code(401).send({ error: "invalid_credentials" });
      }

      logGameEvent(db, {
        kind: "auth.login",
        userId: row.id,
        username,
        message: `Вход: ${username}`,
      });

      const token = signUserToken(row.id, jwtSecret);
      return rep.send({
        token,
        user: {
          id: row.id,
          username,
          factionId: row.faction_id,
          isAdmin: row.is_admin === 1,
        },
      });
    }
  );

  app.get("/api/game/state", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const planet = db
      .prepare(
        `SELECT id, name, arm, system, position, metal, minerals, vespene, last_processed_at, planet_type_id, diameter_km, temperature_min, temperature_max FROM planets WHERE user_id = ? LIMIT 1`
      )
      .get(userId) as
      | {
          id: number;
          name: string;
          arm: number;
          system: number;
          position: number;
          metal: number;
          minerals: number;
          vespene: number;
          last_processed_at: number;
          planet_type_id: string;
          diameter_km: number;
          temperature_min: number;
          temperature_max: number;
        }
      | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    advancePlanet(db, cat(), planet.id, now);
    advanceResearch(db, userId, now);
    advanceFleetMissions(db, cat(), now);

    const p2 = db
      .prepare(
        `SELECT id, name, arm, system, position, metal, minerals, vespene, planet_type_id, diameter_km, temperature_min, temperature_max FROM planets WHERE id = ?`
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
      .prepare(`SELECT username, faction_id, is_admin FROM users WHERE id = ?`)
      .get(userId) as { username: string; faction_id: string; is_admin: number };

    const units = db
      .prepare(`SELECT unit_id, quantity FROM planet_units WHERE planet_id = ?`)
      .all(planet.id) as { unit_id: string; quantity: number }[];

    const defenseRows = db
      .prepare(`SELECT defense_id, quantity FROM planet_defense WHERE planet_id = ?`)
      .all(planet.id) as { defense_id: string; quantity: number }[];

    const research = db
      .prepare(`SELECT research_id, level FROM user_research WHERE user_id = ?`)
      .all(userId) as { research_id: string; level: number }[];

    const researchQueue = db
      .prepare(
        `SELECT id, research_id, target_level, started_at, finishes_at FROM research_queue WHERE user_id = ? LIMIT 1`
      )
      .get(userId) as
      | {
          id: number;
          research_id: string;
          target_level: number;
          started_at: number;
          finishes_at: number;
        }
      | undefined;

    return rep.send({
      serverTime: now,
      user: {
        username: userRow.username,
        factionId: userRow.faction_id,
        isAdmin: userRow.is_admin === 1,
      },
      planet: {
        id: p2.id,
        name: p2.name,
        arm: p2.arm,
        system: p2.system,
        position: p2.position,
        planetTypeId: p2.planet_type_id,
        diameterKm: p2.diameter_km,
        temperatureMin: p2.temperature_min,
        temperatureMax: p2.temperature_max,
        resources: {
          metal: p2.metal,
          minerals: p2.minerals,
          vespene: p2.vespene,
        },
      },
      buildings,
      research,
      researchQueue: researchQueue ?? null,
      buildQueue: queue,
      units,
      defense: defenseRows,
      fleetMissions: listFleetMissions(db, userId).map(serializeFleetMission),
      orbitIntruders: listOrbitIntruders(db).map((i) =>
        serializeOrbitIntruder(i, cat())
      ),
      battleReports: listBattleReports(db, userId).map((r) =>
        serializeBattleReport(r, cat())
      ),
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
    advancePlanet(db, cat(), planet.id, now);
    const r = queueBuild(db, cat(), planet.id, buildingId, userId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "build.queue",
      userId,
      planetId: planet.id,
      message: `Постройка в очередь: ${buildingId}`,
      details: { buildingId },
    });
    return rep.send({ ok: true });
  });

  app.post<{ Body: { researchId?: string } }>("/api/game/research", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const researchId = req.body?.researchId;
    if (!researchId) return rep.code(400).send({ error: "missing_researchId" });

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    advancePlanet(db, cat(), planet.id, now);
    advanceResearch(db, userId, now);
    const r = queueResearch(db, cat(), userId, planet.id, researchId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "research.queue",
      userId,
      planetId: planet.id,
      message: `Исследование в очередь: ${researchId}`,
      details: { researchId },
    });
    return rep.send({ ok: true });
  });

  app.post<{
    Body: {
      targetArm?: number;
      targetSystem?: number;
      targetPosition?: number;
      targetOrbit?: string;
      missionType?: string;
      units?: Record<string, number>;
      speedPct?: number;
      holdMinutes?: number;
    };
  }>("/api/game/fleet/send", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;

    const targetArm = Math.floor(Number(req.body?.targetArm));
    const targetSystem = Math.floor(Number(req.body?.targetSystem));
    const targetPosition = Math.floor(Number(req.body?.targetPosition));
    const targetOrbit = req.body?.targetOrbit?.trim() as
      | "low"
      | "medium"
      | "high"
      | undefined;
    if (!targetOrbit) return rep.code(400).send({ error: "missing_targetOrbit" });

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    const r = sendFleetMission(db, cat(), userId, planet.id, {
      targetArm,
      targetSystem,
      targetPosition,
      targetOrbit,
      missionType: req.body?.missionType === "attack" ? "attack" : "hold",
      units: req.body?.units ?? {},
      speedPct: Math.floor(Number(req.body?.speedPct ?? 100)),
      holdMinutes: Math.floor(Number(req.body?.holdMinutes ?? 0)),
    }, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "fleet.send",
      userId,
      planetId: planet.id,
      message: `Отправка флота на [${targetArm}:${targetSystem}:${targetPosition}] (${targetOrbit})`,
      details: {
        missionId: r.missionId,
        targetArm,
        targetSystem,
        targetPosition,
        targetOrbit,
        units: req.body?.units,
      },
    });
    return rep.send({ ok: true, missionId: r.missionId, arrivesAt: r.arrivesAt });
  });

  app.post<{ Body: { missionId?: number } }>("/api/game/fleet/attack", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;

    const missionId = Math.floor(Number(req.body?.missionId));
    if (!missionId) return rep.code(400).send({ error: "missing_missionId" });

    const now = Date.now();
    advanceFleetMissions(db, cat(), now);
    const r = attackIntruderFromMission(db, cat(), userId, missionId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "battle.attack",
      userId,
      message: `Бой с противником (миссия #${missionId}), исход: ${r.winner}`,
      details: { missionId, reportId: r.reportId, winner: r.winner },
    });
    return rep.send({ ok: true, reportId: r.reportId, winner: r.winner });
  });

  app.post<{ Body: { missionId?: number } }>("/api/game/fleet/recall", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;

    const missionId = Math.floor(Number(req.body?.missionId));
    if (!missionId) return rep.code(400).send({ error: "missing_missionId" });

    const now = Date.now();
    advanceFleetMissions(db, cat(), now);
    const r = recallFleetMission(db, userId, missionId, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "fleet.recall",
      userId,
      message: `Возврат флота с координат (миссия #${missionId})`,
      details: { missionId, arrivesAt: r.arrivesAt },
    });
    return rep.send({ ok: true, arrivesAt: r.arrivesAt });
  });

  app.post<{ Body: { unitId?: string; quantity?: number } }>("/api/game/ships/build", (req, rep) => {
    const userId = requireUser(req, rep, jwtSecret);
    if (userId == null) return;
    const unitId = req.body?.unitId?.trim();
    if (!unitId) return rep.code(400).send({ error: "missing_unitId" });
    const quantity = Math.floor(Number(req.body?.quantity ?? 1));

    const planet = db
      .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
      .get(userId) as { id: number } | undefined;
    if (!planet) return rep.code(404).send({ error: "no_planet" });

    const now = Date.now();
    const r = purchaseFleetUnit(db, cat(), planet.id, unitId, quantity, now);
    if (!r.ok) return rep.code(400).send({ error: r.error });

    logGameEvent(db, {
      kind: "fleet.purchase",
      userId,
      planetId: planet.id,
      message: `Покупка корабля: ${unitId} ×${quantity}`,
      details: { unitId, quantity },
    });
    return rep.send({ ok: true, quantity });
  });

  app.post<{ Body: { defenseId?: string; quantity?: number } }>(
    "/api/game/defense/build",
    (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;
      const defenseId = req.body?.defenseId?.trim();
      if (!defenseId) return rep.code(400).send({ error: "missing_defenseId" });
      const quantity = Math.floor(Number(req.body?.quantity ?? 1));

      const planet = db
        .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
        .get(userId) as { id: number } | undefined;
      if (!planet) return rep.code(404).send({ error: "no_planet" });

      const now = Date.now();
      const r = purchaseDefenseUnit(db, cat(), planet.id, defenseId, quantity, now);
      if (!r.ok) return rep.code(400).send({ error: r.error });

      logGameEvent(db, {
        kind: "defense.purchase",
        userId,
        planetId: planet.id,
        message: `Покупка обороны: ${defenseId} ×${quantity}`,
        details: { defenseId, quantity },
      });
      return rep.send({ ok: true, quantity });
    }
  );

  function parseGalaxyCoord(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number
  ): number {
    const n = Number(raw ?? fallback);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  app.get<{ Querystring: { arm?: string; system?: string } }>(
    "/api/galaxy/system",
    (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;

      const w = cat().world;
      const arm = parseGalaxyCoord(req.query.arm, w.minArm, w.minArm, w.maxArm);
      const system = parseGalaxyCoord(
        req.query.system,
        w.minSystem,
        w.minSystem,
        w.maxSystem
      );

      try {
        return rep.send(buildSystemSlots(db, cat(), arm, system, userId));
      } catch (e) {
        req.log.error(e);
        return rep.code(500).send({ error: "galaxy_load_failed" });
      }
    }
  );

  app.get<{ Querystring: { arm?: string; system?: string; span?: string } }>(
    "/api/galaxy/sector",
    (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;

      const w = cat().world;
      const arm = parseGalaxyCoord(req.query.arm, w.minArm, w.minArm, w.maxArm);
      const system = parseGalaxyCoord(
        req.query.system,
        w.minSystem,
        w.minSystem,
        w.maxSystem
      );
      const span = parseGalaxyCoord(req.query.span, 7, 3, 15);

      try {
        return rep.send(
          buildGalaxySector(db, cat(), arm, system, userId, span)
        );
      } catch (e) {
        req.log.error(e);
        return rep.code(500).send({ error: "galaxy_load_failed" });
      }
    }
  );

  if (cheatsEnabled) {
    app.post<{
      Body: { metal?: unknown; minerals?: unknown; vespene?: unknown };
    }>("/api/game/dev/grant-resources", (req, rep) => {
      const userId = requireUser(req, rep, jwtSecret);
      if (userId == null) return;

      const parse = (v: unknown): number => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.floor(n);
      };
      const metal = parse(req.body?.metal);
      const minerals = parse(req.body?.minerals);
      const vespene = parse(req.body?.vespene);
      if (metal === 0 && minerals === 0 && vespene === 0) {
        return rep.code(400).send({ error: "nothing_to_grant" });
      }

      const planet = db
        .prepare(`SELECT id FROM planets WHERE user_id = ? LIMIT 1`)
        .get(userId) as { id: number } | undefined;
      if (!planet) return rep.code(404).send({ error: "no_planet" });

      const r = grantResources(
        db,
        cat(),
        planet.id,
        { metal, minerals, vespene },
        Date.now()
      );
      if (!r.ok) return rep.code(400).send({ error: r.error });

      logGameEvent(db, {
        kind: "cheat.grant",
        userId,
        planetId: planet.id,
        message: `Начисление ресурсов: +${metal}M +${minerals}Mi +${vespene}V`,
        details: { metal, minerals, vespene },
      });
      return rep.send({ ok: true });
    });
  }

  registerAdminRoutes(app, db, catalogRef, jwtSecret, opts.adminEnabled);
}

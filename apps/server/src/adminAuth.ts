import type Database from "better-sqlite3";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getBearerToken, verifyUserToken } from "./auth.js";

export function userIsAdmin(db: Database.Database, userId: number): boolean {
  const row = db
    .prepare(`SELECT is_admin FROM users WHERE id = ?`)
    .get(userId) as { is_admin: number } | undefined;
  return row?.is_admin === 1;
}

export function syncAdminUsers(db: Database.Database, usernames: string[]): void {
  for (const raw of usernames) {
    const name = raw.trim();
    if (!name) continue;
    db.prepare(`UPDATE users SET is_admin = 1 WHERE username = ?`).run(name);
  }
}

export function isAdminUsername(
  username: string,
  adminUsernames: string[]
): boolean {
  const u = username.trim().toLowerCase();
  return adminUsernames.some((a) => a.trim().toLowerCase() === u);
}

export function requireUser(
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

export function requireAdmin(
  req: FastifyRequest,
  rep: FastifyReply,
  secret: string,
  db: Database.Database
): number | null {
  const userId = requireUser(req, rep, secret);
  if (userId == null) return null;
  if (!userIsAdmin(db, userId)) {
    rep.code(403).send({ error: "forbidden" });
    return null;
  }
  return userId;
}

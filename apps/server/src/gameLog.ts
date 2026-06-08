import type Database from "better-sqlite3";

export interface GameLogRow {
  id: number;
  kind: string;
  user_id: number | null;
  username: string | null;
  planet_id: number | null;
  message: string;
  details_json: string | null;
  created_at: number;
}

export function usernameOf(
  db: Database.Database,
  userId: number
): string | undefined {
  const row = db
    .prepare(`SELECT username FROM users WHERE id = ?`)
    .get(userId) as { username: string } | undefined;
  return row?.username;
}

export function logGameEvent(
  db: Database.Database,
  event: {
    kind: string;
    userId?: number;
    username?: string;
    planetId?: number;
    message: string;
    details?: unknown;
  }
): void {
  const username =
    event.username ??
    (event.userId != null ? usernameOf(db, event.userId) : undefined);
  db.prepare(
    `INSERT INTO game_log (kind, user_id, username, planet_id, message, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.kind,
    event.userId ?? null,
    username ?? null,
    event.planetId ?? null,
    event.message,
    event.details != null ? JSON.stringify(event.details) : null,
    Date.now()
  );
}

export function listGameLogs(
  db: Database.Database,
  opts: { limit?: number; kind?: string; offset?: number } = {}
): GameLogRow[] {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  if (opts.kind) {
    return db
      .prepare(
        `SELECT id, kind, user_id, username, planet_id, message, details_json, created_at
         FROM game_log WHERE kind = ? ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(opts.kind, limit, offset) as GameLogRow[];
  }
  return db
    .prepare(
      `SELECT id, kind, user_id, username, planet_id, message, details_json, created_at
       FROM game_log ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as GameLogRow[];
}

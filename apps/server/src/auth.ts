import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

const HEADER = "authorization";

export function signUserToken(userId: number, secret: string): string {
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn: "7d" });
}

export function verifyUserToken(
  token: string,
  secret: string
): { userId: number } | null {
  try {
    const p = jwt.verify(token, secret) as { sub?: string };
    const id = Number(p.sub);
    if (!Number.isFinite(id)) return null;
    return { userId: id };
  } catch {
    return null;
  }
}

export function getBearerToken(req: FastifyRequest): string | null {
  const h = req.headers[HEADER];
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1] ?? null;
}

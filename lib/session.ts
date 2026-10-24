import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return process.env.SESSION_SECRET || "werkplan-demo-session-secret";
}

export function signSession(userId: string) {
  const sig = createHmac("sha256", secret()).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}

export function readSession(token?: string | null) {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}

export const SESSION_COOKIE = "wp_session";

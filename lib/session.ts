import { createHmac, randomUUID } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "fleet-command-change-this-secret";

export interface SessionPayload {
  sessionId: string;
  fleetId: string;
  exp: number;
}

export function createSessionToken(fleetId: string): {
  token: string;
  sessionId: string;
} {
  const sessionId = randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const body = `${sessionId}.${fleetId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return { token: `${body}.${sig}`, sessionId };
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [sessionId, fleetId, expStr, sig] = parts;
    const body = `${sessionId}.${fleetId}.${expStr}`;
    const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
    if (sig !== expected) return null;
    const exp = parseInt(expStr, 10);
    if (Math.floor(Date.now() / 1000) > exp) return null;
    return { sessionId, fleetId, exp };
  } catch {
    return null;
  }
}

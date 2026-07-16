import type { VercelRequest } from "@vercel/node";
import { authAdmin } from "./admin";

export interface AuthResult {
  uid: string;
  email?: string;
}

/**
 * Verifies the Firebase ID token sent by the client in the
 * `Authorization: Bearer <token>` header. Throws an Error with an
 * HTTP-status-like `.status` property on failure, mirroring the old
 * HttpsError("unauthenticated", ...) behaviour.
 */
export async function requireAuth(req: VercelRequest): Promise<AuthResult> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err: any = new Error("É necessário iniciar sessão.");
    err.status = 401;
    err.code = "unauthenticated";
    throw err;
  }
  try {
    const decoded = await authAdmin.verifyIdToken(match[1]);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    const err: any = new Error("Sessão inválida ou expirada.");
    err.status = 401;
    err.code = "unauthenticated";
    throw err;
  }
}

import * as admin from "firebase-admin";

/**
 * Shared Firebase Admin bootstrap for Vercel Serverless Functions.
 *
 * Runs with a service account (full Admin SDK privileges), so it is NOT
 * subject to firestore.rules. This mirrors the old functions/src/index.ts
 * setup, just hosted on Vercel instead of Cloud Functions.
 *
 * Required env vars (set in Vercel Project Settings -> Environment Variables,
 * for BOTH Production and Preview, then trigger a new deploy):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (paste the key with real newlines; Vercel's UI
 *                           preserves them. If pasted as a single line with
 *                           literal "\n", the replace() below fixes it.)
 *
 * Initialization is lazy (only runs on first call inside a handler's
 * try/catch), so a missing/broken credential surfaces as a normal JSON
 * { error, message } response instead of an unhandled crash with no body.
 */
function init() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const missing = [
    !projectId && "FIREBASE_PROJECT_ID",
    !clientEmail && "FIREBASE_CLIENT_EMAIL",
    !privateKey && "FIREBASE_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente em falta no Vercel: ${missing.join(", ")}. ` +
        `Define-as em Project Settings -> Environment Variables (Production e Preview) e faz um novo deploy.`
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey: privateKey as string }),
  });
}

export function getDb() {
  init();
  return admin.firestore();
}

export function getAuthAdmin() {
  init();
  return admin.auth();
}

export { admin };

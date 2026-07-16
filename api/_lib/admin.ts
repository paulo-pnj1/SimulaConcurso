import * as admin from "firebase-admin";

/**
 * Shared Firebase Admin bootstrap for Vercel Serverless Functions.
 *
 * Runs with a service account (full Admin SDK privileges), so it is NOT
 * subject to firestore.rules. This mirrors the old functions/src/index.ts
 * setup, just hosted on Vercel instead of Cloud Functions.
 *
 * Required env vars (set in Vercel Project Settings -> Environment Variables):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (paste the key with real newlines; Vercel's UI
 *                           preserves them. If pasted as a single line with
 *                           literal "\n", the replace() below fixes it.)
 */
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel env vars."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export { admin };

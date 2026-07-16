import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/health
 *
 * Diagnostic-only endpoint. Reports (without leaking secret values):
 *  - which env vars are present
 *  - whether firebase-admin initializes successfully
 *  - whether Firestore can be reached
 *
 * Visit this directly in the browser after deploying to see exactly what's
 * wrong, instead of guessing from a generic 500. Safe to delete once
 * getExamQuestions/submitExam are working (or keep it, it never returns
 * secrets or question data).
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const report: Record<string, unknown> = {
    node: process.version,
    env: {
      FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
      FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      FIREBASE_PRIVATE_KEY_looks_like_pem: Boolean(
        process.env.FIREBASE_PRIVATE_KEY?.includes("BEGIN PRIVATE KEY")
      ),
    },
  };

  try {
    const { getDb } = await import("./_lib/admin.js");
    const db = getDb();
    report.adminInit = "ok";

    try {
      // Cheapest possible real read: just touch a collection, don't require
      // the doc to exist.
      await db.collection("users").limit(1).get();
      report.firestoreRead = "ok";
    } catch (e: any) {
      report.firestoreRead = "failed";
      report.firestoreError = e?.message || String(e);
    }
  } catch (e: any) {
    report.adminInit = "failed";
    report.adminInitError = e?.message || String(e);
  }

  res.status(200).json(report);
}

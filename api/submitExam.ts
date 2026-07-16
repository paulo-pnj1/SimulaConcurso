import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { admin, getDb } from "./_lib/admin.js";
import {
  ACCESS_DENIED_MESSAGE,
  ConcursoType,
  hasFullAccess,
  loadFullQuestionBank,
} from "./_lib/questions.js";

/**
 * POST /api/submitExam
 * Body: { ministerio, respostas: Record<number, number>, secondsElapsed }
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * Grades the exam server-side. The client only ever sends chosen option
 * indices; correct answers/explanations are only returned after grading.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  try {
    const { uid, email } = await requireAuth(req);

    const { ministerio, respostas, secondsElapsed } = (req.body || {}) as {
      ministerio: ConcursoType;
      respostas: Record<number, number>;
      secondsElapsed: number;
    };

    if (ministerio !== "MININT" && ministerio !== "MINSA") {
      res.status(400).json({ error: "invalid-argument", message: "Ministério inválido." });
      return;
    }
    if (!respostas || typeof respostas !== "object") {
      res.status(400).json({ error: "invalid-argument", message: "Respostas em falta." });
      return;
    }

    const fullAccess = await hasFullAccess(uid, email);
    if (!fullAccess) {
      res.status(403).json({ error: "permission-denied", message: ACCESS_DENIED_MESSAGE });
      return;
    }

    const db = getDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as { name?: string }) : undefined;

    const graded = await loadFullQuestionBank(ministerio);

    let acertosCount = 0;
    const revisao = graded.map((p) => {
      const respostaCandidato = respostas[p.id];
      if (respostaCandidato === p.resposta) acertosCount++;
      return { id: p.id, resposta: p.resposta, explicacao: p.explicacao };
    });

    const scorePercentage = graded.length > 0 ? Math.round((acertosCount / graded.length) * 100) : 0;
    const resultId = db.collection("resultados").doc().id;

    const resultado = {
      id: resultId,
      candidateUid: uid,
      candidateName: userData?.name || email?.split("@")[0] || "Candidato",
      candidateEmail: email || "",
      ministerio,
      score: scorePercentage,
      respostasCorretas: acertosCount,
      totalPerguntas: graded.length,
      tempoGasto: Math.max(0, Math.floor(Number(secondsElapsed) || 0)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("resultados").doc(resultId).set(resultado);

    res.status(200).json({
      score: scorePercentage,
      respostasCorretas: acertosCount,
      totalPerguntas: graded.length,
      revisao,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.code || "internal", message: err?.message || "Erro interno." });
  }
}

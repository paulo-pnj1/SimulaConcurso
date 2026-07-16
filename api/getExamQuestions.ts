import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import {
  ACCESS_DENIED_MESSAGE,
  CORPOS_MININT,
  ConcursoType,
  CorpoMinint,
  hasFullAccess,
  loadFullQuestionBank,
  stripAnswers,
} from "./_lib/questions.js";

/**
 * POST /api/getExamQuestions
 * Body: { ministerio: "MININT" | "MINSA", corpo?: CorpoMinint }
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * `corpo` é obrigatório quando ministerio === "MININT" (Polícia Nacional,
 * SIC, SME, Serviço Penitenciário ou Proteção Civil e Bombeiros); ignorado
 * para MINSA.
 *
 * Returns the question set for a ministry WITHOUT the correct answer or
 * explanation. Same-origin call from the Vercel-hosted frontend, so there
 * is no CORS involved at all.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  try {
    const { uid, email } = await requireAuth(req);

    const ministerio = req.body?.ministerio as ConcursoType;
    if (ministerio !== "MININT" && ministerio !== "MINSA") {
      res.status(400).json({ error: "invalid-argument", message: "Ministério inválido." });
      return;
    }

    const corpo = req.body?.corpo as CorpoMinint | undefined;
    if (ministerio === "MININT" && (!corpo || !CORPOS_MININT.includes(corpo))) {
      res.status(400).json({
        error: "invalid-argument",
        message: "Corpo do MININT inválido ou em falta. Escolha um dos corpos disponíveis.",
      });
      return;
    }

    const fullAccess = await hasFullAccess(uid, email);
    if (!fullAccess) {
      res.status(403).json({ error: "permission-denied", message: ACCESS_DENIED_MESSAGE });
      return;
    }

    const all = await loadFullQuestionBank(ministerio, corpo);
    if (all.length === 0) {
      res.status(404).json({
        error: "not-found",
        message: `Sem perguntas para o ministério ${ministerio}.`,
      });
      return;
    }

    res.status(200).json({ perguntas: stripAnswers(all) });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.code || "internal", message: err?.message || "Erro interno." });
  }
}

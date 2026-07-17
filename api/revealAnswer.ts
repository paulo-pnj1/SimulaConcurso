import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import {
  ACCESS_DENIED_MESSAGE,
  CORPOS_MININT,
  ConcursoType,
  CorpoMinint,
  hasFullAccess,
  loadFullQuestionBank,
} from "./_lib/questions.js";

/**
 * POST /api/revealAnswer
 * Body: { ministerio: "MININT" | "MINSA", corpo?: CorpoMinint, perguntaId: number }
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * Devolve a resposta certa e a explicação de UMA única pergunta, a pedido
 * explícito do candidato - para quem está a estudar e quer confirmar o
 * gabarito de uma pergunta específica sem submeter a prova toda nem
 * terminar todas as rondas. Ao contrário de /api/submitExam, esta chamada
 * NÃO grava nenhum resultado em Firestore: é só consulta, não conta como
 * tentativa de exame.
 *
 * `corpo` deve corresponder ao caderno de perguntas mostrado ao candidato
 * (o mesmo usado em /api/getExamQuestions), para garantir que a pergunta
 * pedida pertence mesmo ao exame que ele está a fazer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  try {
    const { uid, email } = await requireAuth(req);

    const { ministerio, corpo, perguntaId } = (req.body || {}) as {
      ministerio: ConcursoType;
      corpo?: CorpoMinint;
      perguntaId: number;
    };

    if (ministerio !== "MININT" && ministerio !== "MINSA") {
      res.status(400).json({ error: "invalid-argument", message: "Ministério inválido." });
      return;
    }
    if (ministerio === "MININT" && (!corpo || !CORPOS_MININT.includes(corpo))) {
      res.status(400).json({
        error: "invalid-argument",
        message: "Corpo do MININT inválido ou em falta.",
      });
      return;
    }
    if (typeof perguntaId !== "number") {
      res.status(400).json({ error: "invalid-argument", message: "Pergunta inválida." });
      return;
    }

    const fullAccess = await hasFullAccess(uid, email);
    if (!fullAccess) {
      res.status(403).json({ error: "permission-denied", message: ACCESS_DENIED_MESSAGE });
      return;
    }

    const bank = await loadFullQuestionBank(ministerio, corpo);
    const pergunta = bank.find((p) => p.id === perguntaId);

    if (!pergunta) {
      res.status(404).json({ error: "not-found", message: "Pergunta não encontrada neste caderno." });
      return;
    }

    res.status(200).json({
      id: pergunta.id,
      resposta: pergunta.resposta,
      explicacao: pergunta.explicacao,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.code || "internal", message: err?.message || "Erro interno." });
  }
}

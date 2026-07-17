import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_lib/admin.js";

/**
 * GET /api/candidateCount
 *
 * Endpoint público (sem autenticação) que devolve apenas o número de
 * candidatos registados. Usado para o selo de prova social no AuthScreen
 * ("+X candidatos já estão a preparar-se com o EstudaBué!").
 *
 * Corre com o Admin SDK (via getDb), portanto ignora as firestore.rules —
 * é o único jeito de contar a coleção "users", já que as regras só
 * permitem `list` a administradores. Não devolve nenhum dado individual,
 * só a contagem agregada, por isso é seguro expor sem token.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Cache curta no CDN da Vercel: a contagem não precisa de ser exata ao
  // segundo, e isto poupa leituras do Firestore em picos de tráfego.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  try {
    const db = getDb();
    const snap = await db.collection("users").where("role", "==", "candidate").count().get();
    res.status(200).json({ count: snap.data().count });
  } catch (e: any) {
    console.error("Erro ao contar candidatos:", e);
    // Falha de forma silenciosa do lado do cliente: o chamador trata
    // count == null como "não mostrar o selo", nunca como erro fatal.
    res.status(200).json({ count: null, error: e?.message || String(e) });
  }
}

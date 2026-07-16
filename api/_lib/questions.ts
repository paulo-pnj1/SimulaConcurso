import { db } from "./admin";
import baseQuestions from "./data/perguntas.json";
import { ADMIN_EMAIL } from "./config";

export type ConcursoType = "MININT" | "MINSA";

export interface Pergunta {
  id: number;
  ministerio: ConcursoType;
  categoria: string;
  enunciado: string;
  opcoes: string[];
  resposta: number;
  explicacao: string;
}

/**
 * Loads the full question bank (bundled base questions + admin-created
 * custom questions from Firestore) for a given ministry. Runs with Admin
 * SDK privileges, so it bypasses firestore.rules. This is the only place
 * that assembles a full `Pergunta` (including resposta/explicacao) before
 * an exam is served or graded.
 */
export async function loadFullQuestionBank(ministerio: ConcursoType): Promise<Pergunta[]> {
  const custom = await db.collection("perguntas").where("ministerio", "==", ministerio).get();
  const customQuestions = custom.docs.map((d) => d.data() as Pergunta);
  const base = (baseQuestions as Pergunta[]).filter((q) => q.ministerio === ministerio);
  return [...base, ...customQuestions];
}

export async function hasFullAccess(uid: string, email: string | undefined): Promise<boolean> {
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() as { role?: string; isPremium?: boolean };
  return data.role === "admin" || data.isPremium === true;
}

export function stripAnswers(questions: Pergunta[]) {
  return questions.map(({ resposta, explicacao, ...rest }) => rest);
}

export const ACCESS_DENIED_MESSAGE =
  "É necessário ativar o acesso pago para aceder aos estudos e simulações. Efetue o pagamento por Multicaixa Express e aguarde a validação do administrador.";

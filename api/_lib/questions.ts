import { getDb } from "./admin.js";
import { ADMIN_EMAIL } from "./config.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lê o perguntas.json em runtime via fs em vez de "import ... from '...json'".
 * Em Node 20.10+/22+ com "type": "module" no package.json, importar JSON
 * estaticamente exige o atributo `with { type: "json" }`, que o bundler da
 * Vercel nem sempre preserva/injeta corretamente (causava
 * ERR_IMPORT_ATTRIBUTE_MISSING em produção). Ler com fs evita essa
 * dependência do loader ESM e funciona em qualquer versão do Node.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseQuestions = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "perguntas.json"), "utf-8")
);

export type ConcursoType = "MININT" | "MINSA";

export type CorpoMinint =
  | "Polícia Nacional"
  | "Serviço de Investigação Criminal (SIC)"
  | "Serviço de Migração e Estrangeiros (SME)"
  | "Serviço Penitenciário"
  | "Proteção Civil e Bombeiros";

export const CORPOS_MININT: CorpoMinint[] = [
  "Polícia Nacional",
  "Serviço de Investigação Criminal (SIC)",
  "Serviço de Migração e Estrangeiros (SME)",
  "Serviço Penitenciário",
  "Proteção Civil e Bombeiros",
];

export interface Pergunta {
  id: number;
  ministerio: ConcursoType;
  // Só se aplica a MININT. Sem "corpo" = pergunta geral, entra no exame de
  // qualquer corpo. Com "corpo" = só entra no exame desse corpo específico.
  corpo?: CorpoMinint;
  categoria: string;
  enunciado: string;
  opcoes: string[];
  resposta: number;
  explicacao: string;
}

/**
 * Loads the full question bank (bundled base questions + admin-created
 * custom questions from Firestore) for a given ministry, optionally scoped
 * to a specific MININT "corpo" (Polícia Nacional, SIC, SME, Serviço
 * Penitenciário, Proteção Civil e Bombeiros).
 *
 * For MININT with a corpo: includes general questions (no `corpo` set) +
 * questions tagged with that exact corpo. Questions tagged with a
 * *different* corpo are excluded.
 *
 * Runs with Admin SDK privileges, so it bypasses firestore.rules. This is
 * the only place that assembles a full `Pergunta` (including
 * resposta/explicacao) before an exam is served or graded.
 */
export async function loadFullQuestionBank(
  ministerio: ConcursoType,
  corpo?: CorpoMinint
): Promise<Pergunta[]> {
  const db = getDb();
  const custom = await db.collection("perguntas").where("ministerio", "==", ministerio).get();
  const customQuestions = custom.docs.map((d) => d.data() as Pergunta);
  const base = (baseQuestions as Pergunta[]).filter((q) => q.ministerio === ministerio);
  const all = [...base, ...customQuestions];

  if (ministerio !== "MININT" || !corpo) return all;

  return all.filter((q) => !q.corpo || q.corpo === corpo);
}

export async function hasFullAccess(uid: string, email: string | undefined): Promise<boolean> {
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  const db = getDb();
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

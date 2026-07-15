import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { ADMIN_EMAIL } from "./config";
import baseQuestions from "../data/perguntas.json";

admin.initializeApp();
const db = admin.firestore();

type ConcursoType = "MININT" | "MINSA";

interface Pergunta {
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
 * custom questions from Firestore) for a given ministry. This runs with
 * Admin SDK privileges, so it is NOT subject to firestore.rules and is the
 * only place in the whole system where a full `Pergunta` (including
 * `resposta`/`explicacao`) is assembled before an exam is graded.
 */
async function loadFullQuestionBank(ministerio: ConcursoType): Promise<Pergunta[]> {
  const custom = await db.collection("perguntas").where("ministerio", "==", ministerio).get();
  const customQuestions = custom.docs.map((d) => d.data() as Pergunta);
  const base = (baseQuestions as Pergunta[]).filter((q) => q.ministerio === ministerio);
  return [...base, ...customQuestions];
}

async function hasFullAccess(uid: string, email: string | undefined): Promise<boolean> {
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() as { role?: string; isPremium?: boolean };
  return data.role === "admin" || data.isPremium === true;
}

function stripAnswers(questions: Pergunta[]) {
  return questions.map(({ resposta, explicacao, ...rest }) => rest);
}

const ACCESS_DENIED_MESSAGE =
  "É necessário ativar o acesso pago para aceder aos estudos e simulações. Efetue o pagamento por Multicaixa Express e aguarde a validação do administrador.";

/**
 * Callable: returns the question set for a ministry WITHOUT the correct
 * answer or explanation. This replaces the old client-side
 * fetch("/perguntas.json") + Firestore read, which leaked answers to anyone
 * who opened devtools before answering. There is no free-trial subset: a
 * candidate either has full paid access, or gets no questions at all.
 */
export const getExamQuestions = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
  }
  const ministerio = request.data?.ministerio as ConcursoType;
  if (ministerio !== "MININT" && ministerio !== "MINSA") {
    throw new HttpsError("invalid-argument", "Ministério inválido.");
  }

  const fullAccess = await hasFullAccess(request.auth.uid, request.auth.token.email);
  if (!fullAccess) {
    throw new HttpsError("permission-denied", ACCESS_DENIED_MESSAGE);
  }

  const all = await loadFullQuestionBank(ministerio);
  if (all.length === 0) {
    throw new HttpsError("not-found", `Sem perguntas para o ministério ${ministerio}.`);
  }

  return { perguntas: stripAnswers(all) };
});

/**
 * Callable: grades an exam server-side. The client only ever sends the
 * candidate's chosen option indices; the correct answers never leave the
 * server until after grading, when the review (correct answers +
 * explanations) is sent back for the results screen.
 */
export const submitExam = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
  }
  const { ministerio, respostas, secondsElapsed } = request.data as {
    ministerio: ConcursoType;
    respostas: Record<number, number>;
    secondsElapsed: number;
  };
  if (ministerio !== "MININT" && ministerio !== "MINSA") {
    throw new HttpsError("invalid-argument", "Ministério inválido.");
  }
  if (!respostas || typeof respostas !== "object") {
    throw new HttpsError("invalid-argument", "Respostas em falta.");
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email as string | undefined;

  const fullAccess = await hasFullAccess(uid, email);
  if (!fullAccess) {
    throw new HttpsError("permission-denied", ACCESS_DENIED_MESSAGE);
  }

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

  return {
    score: scorePercentage,
    respostasCorretas: acertosCount,
    totalPerguntas: graded.length,
    revisao,
  };
});

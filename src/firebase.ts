import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Server-side question delivery + grading now live as Vercel Serverless
// Functions under /api (see /api/getExamQuestions.ts and /api/submitExam.ts),
// instead of Firebase Cloud Functions. Because the frontend and /api share
// the same Vercel domain, these are same-origin calls: no CORS, no Cloud
// Functions gen2 invoker/IAM setup needed.
//
// The wrappers below return `{ data }` to match the shape the old
// `httpsCallable` result had, so the rest of the app doesn't need to change.
async function callApi<TResponse>(path: string, body: unknown): Promise<{ data: TResponse }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("É necessário iniciar sessão.");
  }
  const idToken = await user.getIdToken();

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Erro ao chamar ${path} (HTTP ${res.status}).`);
  }
  return { data: json as TResponse };
}

export const getExamQuestionsFn = (data: { ministerio: string }) =>
  callApi("/api/getExamQuestions", data);

export const submitExamFn = (data: {
  ministerio: string;
  respostas: Record<number, number>;
  secondsElapsed: number;
}) => callApi("/api/submitExam", data);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

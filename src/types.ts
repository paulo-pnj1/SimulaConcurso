export interface Pergunta {
  id: number;
  ministerio: "MININT" | "MINSA";
  categoria: string;
  enunciado: string;
  opcoes: string[];
  resposta: number; // 0 a 3
  explicacao: string;
}

export type ConcursoType = "MININT" | "MINSA";

export interface RespostasUsuario {
  [perguntaId: number]: number; // perguntaId -> indice da opcao selecionada
}

export interface Resultado {
  id: string;
  candidateUid: string;
  candidateName: string;
  candidateEmail: string;
  ministerio: ConcursoType;
  score: number;
  respostasCorretas: number;
  totalPerguntas: number;
  tempoGasto: number;
  createdAt: string;
}

// Question shape returned by the getExamQuestions Cloud Function: no
// `resposta`/`explicacao` until the exam has been submitted and graded.
export type PerguntaSemGabarito = Omit<Pergunta, "resposta" | "explicacao">;

export interface RevisaoItem {
  id: number;
  resposta: number;
  explicacao: string;
}

export interface SubmitExamResponse {
  score: number;
  respostasCorretas: number;
  totalPerguntas: number;
  revisao: RevisaoItem[];
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  telefone?: string; // Número de telemóvel do candidato (usado para confirmar o pagamento Multicaixa Express)
  role: "admin" | "candidate";
  isPremium?: boolean;
  premiumActivatedAt?: string;
  // "none": ainda não pagou / "pending": disse que pagou, aguarda verificação do admin
  paymentStatus?: "none" | "pending";
  pendingSince?: string;
}

// ==========================================================
// CONFIGURAÇÃO DO PLANO PREMIUM — edite estes valores livremente
// ==========================================================
export const PREMIUM_CONFIG = {
  // Preço de acesso vitalício (ajuste conforme desejar)
  priceLabel: "500 Kz",
  // Dados de pagamento por Multicaixa Express / Transferência (EDITE com os seus dados reais)
  multicaixaExpressNumber: "926 419 463",
  ibanTransferencia: "AO06 0040 0000 9174 0854 1012 1",
  nomeTitular: "Paulo Nkee Joao",
  // Número de WhatsApp do administrador para envio do comprovativo (formato internacional, sem "+")
  whatsappAdmin: "944 859 567",
};

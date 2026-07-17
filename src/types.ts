export type CorpoMinint =
  | "Polícia Nacional"
  | "Serviço de Investigação Criminal (SIC)"
  | "Serviço de Migração e Estrangeiros (SME)"
  | "Serviço Penitenciário"
  | "Proteção Civil e Bombeiros";

export const CORPOS_MININT: { id: CorpoMinint; sigla: string; descricao: string }[] = [
  {
    id: "Polícia Nacional",
    sigla: "PN",
    descricao: "Manutenção da ordem, segurança e tranquilidade públicas em todo o território nacional.",
  },
  {
    id: "Serviço de Investigação Criminal (SIC)",
    sigla: "SIC",
    descricao: "Investigação criminal, recolha de prova e coadjuvação do Ministério Público.",
  },
  {
    id: "Serviço de Migração e Estrangeiros (SME)",
    sigla: "SME",
    descricao: "Controlo de fronteiras, vistos, permanência e regime de estrangeiros em Angola.",
  },
  {
    id: "Serviço Penitenciário",
    sigla: "SP",
    descricao: "Custódia, segurança e reinserção social de reclusos nos estabelecimentos prisionais.",
  },
  {
    id: "Proteção Civil e Bombeiros",
    sigla: "PCB",
    descricao: "Socorro, combate a incêndios e resposta a catástrofes e emergências civis.",
  },
];

export interface Pergunta {
  id: number;
  ministerio: "MININT" | "MINSA";
  // Só se aplica a perguntas de MININT. Perguntas sem "corpo" são gerais
  // (Constituição, símbolos nacionais, etc.) e entram no exame de qualquer
  // corpo; perguntas com "corpo" só entram no exame desse corpo específico.
  corpo?: CorpoMinint;
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
  corpo?: CorpoMinint;
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

// Resposta do endpoint /api/revealAnswer: devolve a resposta certa e a
// explicação de UMA única pergunta, a pedido do candidato, sem submeter
// nem gravar a prova. Usado no modo de estudo dentro do simulador, para
// quem quer ver o gabarito de uma pergunta sem terminar todas as rondas.
export interface RevealAnswerResponse {
  id: number;
  resposta: number;
  explicacao: string;
}

// Manual de estudo em PDF. O Admin regista o título e um link (Google
// Drive, Dropbox, etc.) e os candidatos Premium descarregam a partir daí.
// Não usa Firebase Storage (esse serviço passou a exigir o plano pago
// Blaze); os ficheiros ficam alojados fora, só a referência vive aqui.
// "ministerio" pode ser MININT/MINSA ou "TODOS" (manuais gerais, ex:
// Constituição da República). "corpo" só se aplica quando
// ministerio === "MININT" e o manual é específico de um corpo.
export interface Manual {
  id: string;
  titulo: string;
  descricao: string;
  ministerio: ConcursoType | "TODOS";
  corpo?: CorpoMinint;
  fileUrl: string;
  createdBy: string;
  createdAt: string;
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
// CONFIGURAÇÃO DO PLANO PREMIUM - edite estes valores livremente
// ==========================================================
export const PREMIUM_CONFIG = {
  // Preço de acesso vitalício (ajuste conforme desejar)
  priceLabel: "1000",
  // Dados de pagamento por Multicaixa Express / Transferência (EDITE com os seus dados reais)
  multicaixaExpressNumber: "926 419 463",
  ibanTransferencia: "AO06 0040 0000 9174 0854 1012 1",
  nomeTitular: "Paulo Nkee Joao",
  // Número de WhatsApp do administrador para envio do comprovativo (formato internacional, sem "+")
  whatsappAdmin: "944 859 567",
};

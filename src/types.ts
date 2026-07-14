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

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "candidate";
  isPremium?: boolean;
  premiumActivatedAt?: string;
}

// ==========================================================
// CONFIGURAÇÃO DO PLANO PREMIUM — edite estes valores livremente
// ==========================================================
export const PREMIUM_CONFIG = {
  // Número de perguntas gratuitas por simulação (amostra) para quem NÃO é Premium
  freeQuestionLimit: 2,
  // Preço de acesso vitalício (ajuste conforme desejar)
  priceLabel: "500 Kz",
  // Dados de pagamento por Multicaixa Express / Transferência (EDITE com os seus dados reais)
  multicaixaExpressNumber: "926 419 463",
  ibanTransferencia: "AO06 0040 0000 9174 0854 1012 1",
  nomeTitular: "Paulo Nkee Joao",
  // Número de WhatsApp do administrador para envio do comprovativo (formato internacional, sem "+")
  whatsappAdmin: "944 859 567",
};

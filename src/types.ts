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

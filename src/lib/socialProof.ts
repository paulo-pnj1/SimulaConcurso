/**
 * Transforma uma contagem real de candidatos numa etiqueta de prova social
 * honesta - arredondada sempre para BAIXO, nunca para cima. Isto garante
 * que a frase mostrada ("+X candidatos...") é sempre verdadeira ou
 * conservadora, nunca inflacionada.
 *
 * Devolve `null` quando a amostra ainda é demasiado pequena para ser
 * credível como prova social (evita mostrar "+5 candidatos", que soa mais
 * a alarme do que a confiança).
 */
export function formatCandidateCountLabel(rawCount: number | null | undefined): string | null {
  if (rawCount == null || !Number.isFinite(rawCount) || rawCount < 10) {
    return null;
  }

  let step: number;
  if (rawCount < 50) {
    step = 5;
  } else if (rawCount < 100) {
    step = 10;
  } else if (rawCount < 1000) {
    step = 50;
  } else {
    step = 100;
  }

  const rounded = Math.floor(rawCount / step) * step;
  return `+${rounded} candidatos já estão a preparar-se com o EstudaBué!`;
}

import { Award, CheckCircle2, XCircle, ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import { Pergunta, RespostasUsuario, ConcursoType } from "../types";
import { motion } from "motion/react";

interface ResultsScreenProps {
  ministerio: ConcursoType;
  perguntas: Pergunta[];
  respostas: RespostasUsuario;
  onRestart: () => void;
}

export default function ResultsScreen({
  ministerio,
  perguntas,
  respostas,
  onRestart,
}: ResultsScreenProps) {
  const totalPerguntas = perguntas.length;
  
  // Calculate correct answers
  let acertosCount = 0;
  perguntas.forEach((p) => {
    if (respostas[p.id] === p.resposta) {
      acertosCount++;
    }
  });

  // Score from 0 to 20
  const notaFinal = (acertosCount / totalPerguntas) * 20;
  const isApto = notaFinal >= 10;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Result Card Summary */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-8 shadow-sm mb-8 relative overflow-hidden">
        {/* Colorful top border representing status */}
        <div className={`absolute top-0 left-0 w-full h-2 ${isApto ? "bg-[#22C55E]" : "bg-[#C02424]"}`} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-widest block mb-2">
              Resultado Oficial • Simulação {ministerio}
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A365D] mb-4">
              Folha de Avaliação Individual
            </h2>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-center">
                <span className="text-xs text-[#64748B] block font-medium uppercase">Respostas</span>
                <span className="text-base font-bold text-[#1C1E21]">
                  {Object.keys(respostas).length} de {totalPerguntas}
                </span>
              </div>
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl px-4 py-2.5 text-center">
                <span className="text-xs text-[#166534] block font-medium uppercase">Acertos</span>
                <span className="text-base font-bold text-[#166534]">
                  {acertosCount} de {totalPerguntas}
                </span>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-center">
                <span className="text-xs text-[#64748B] block font-medium uppercase">Aproveitamento</span>
                <span className="text-base font-bold text-[#1C1E21]">
                  {Math.round((acertosCount / totalPerguntas) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Large Badge Area */}
          <div className="flex flex-col items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 w-full md:w-56 text-center">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Nota Final</span>
            
            <div className={`text-4xl md:text-5xl font-extrabold font-mono mb-3 ${isApto ? "text-[#166534]" : "text-[#991B1B]"}`}>
              {notaFinal % 1 === 0 ? notaFinal : notaFinal.toFixed(1)} <span className="text-sm font-semibold text-[#64748B]">/ 20</span>
            </div>

            <div className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
              isApto 
                ? "bg-[#DCFCE7] text-[#166534]" 
                : "bg-[#FEE2E2] text-[#991B1B]"
            }`}>
              {isApto ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  <span>APTO</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-[#991B1B]" />
                  <span>EXCLUÍDO</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Buttons / Navigation back */}
      <div className="flex justify-center mb-12">
        <button
          id="btn-voltar-inicio"
          onClick={onRestart}
          className="inline-flex items-center space-x-2 bg-[#1A365D] hover:bg-[#152c4a] text-white px-6 py-3.5 rounded-xl font-semibold shadow-md transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar ao Menu Principal</span>
        </button>
      </div>

      {/* Detailed Correction Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-[#1A365D] flex items-center mb-4">
          <BookOpen className="w-5 h-5 mr-2 text-[#1A365D]" />
          Correção Comentada das Perguntas
        </h3>

        {perguntas.map((p, index) => {
          const userChoice = respostas[p.id];
          const isCorrect = userChoice === p.resposta;

          return (
            <div
              key={p.id}
              id={`correcao-questao-${index + 1}`}
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-xs relative overflow-hidden"
            >
              {/* Vertical side indicator strip */}
              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                userChoice === undefined 
                  ? "bg-[#CBD5E1]" 
                  : isCorrect 
                    ? "bg-[#22C55E]" 
                    : "bg-[#C02424]"
              }`} />

              <div className="pl-2">
                {/* Meta details */}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-[#475569] uppercase tracking-wider bg-[#E2E8F0] px-2.5 py-1 rounded border border-[#CBD5E1]">
                    {p.categoria}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-[#64748B]">Questão {index + 1}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      userChoice === undefined
                        ? "bg-[#E2E8F0] text-[#475569]"
                        : isCorrect
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : "bg-[#FEE2E2] text-[#991B1B]"
                    }`}>
                      {userChoice === undefined 
                        ? "Não Respondida" 
                        : isCorrect 
                          ? "Acertou" 
                          : "Errou"
                      }
                    </span>
                  </div>
                </div>

                {/* Question enunciado */}
                <h4 className="text-base font-semibold text-[#1C1E21] mb-4 leading-relaxed">
                  {p.enunciado}
                </h4>

                {/* Options representation in results */}
                <div className="space-y-2 mb-4">
                  {p.opcoes.map((opcao, optIdx) => {
                    const isSelected = userChoice === optIdx;
                    const isCorrectAnswer = p.resposta === optIdx;

                    let optionBorder = "border-[#E2E8F0]";
                    let optionBg = "bg-white";
                    let textStyle = "text-[#1C1E21]";
                    let badgeNode = null;

                    if (isCorrectAnswer) {
                      // Correct option is highlighted green
                      optionBorder = "border-[#22C55E] ring-1 ring-[#22C55E]";
                      optionBg = "bg-[#F0FDF4]";
                      textStyle = "text-[#166534] font-semibold";
                      badgeNode = (
                        <span className="text-xs font-bold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded uppercase">
                          Gabarito Oficial
                        </span>
                      );
                    } else if (isSelected && !isCorrect) {
                      // Wrong user selection is highlighted red
                      optionBorder = "border-[#C02424] ring-1 ring-[#C02424]";
                      optionBg = "bg-[#FEF2F2]";
                      textStyle = "text-[#991B1B] font-semibold";
                      badgeNode = (
                        <span className="text-xs font-bold text-[#991B1B] bg-[#FEE2E2] px-2 py-0.5 rounded uppercase">
                          A sua escolha
                        </span>
                      );
                    } else if (isSelected && isCorrect) {
                      // Correct user selection
                      badgeNode = (
                        <span className="text-xs font-bold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded uppercase">
                          A sua escolha (Correta)
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-start justify-between p-3.5 rounded-xl border-2 text-sm ${optionBorder} ${optionBg} ${textStyle}`}
                      >
                        <div className="flex items-start space-x-3">
                          <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] uppercase ${
                            isCorrectAnswer
                              ? "bg-[#22C55E] text-white"
                              : isSelected
                                ? "bg-[#C02424] text-white"
                                : "bg-[#E2E8F0] text-[#475569]"
                          }`}>
                            {["A", "B", "C", "D"][optIdx]}
                          </span>
                          <span className="leading-tight">{opcao}</span>
                        </div>
                        {badgeNode}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation block */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs md:text-sm text-[#1C1E21] leading-relaxed">
                  <div className="font-bold flex items-center mb-1.5 text-[#1A365D] text-xs uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 mr-1 text-[#1A365D] flex-shrink-0" />
                    Enquadramento Legal e Pedagógico
                  </div>
                  <p className="font-light text-[#475569]">{p.explicacao}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-12 mb-6 text-xs text-gray-400">
        Simulador de Concurso Público em Angola • MININT & MINSA • Todos os direitos reservados.
      </div>
    </div>
  );
}

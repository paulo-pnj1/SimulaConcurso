import { Award, CheckCircle2, XCircle, ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import { Pergunta, RespostasUsuario, ConcursoType } from "../types";
import { motion } from "motion/react";

interface ResultsScreenProps {
  ministerio: ConcursoType;
  corpo?: string;
  perguntas: Pergunta[];
  respostas: RespostasUsuario;
  onRestart: () => void;
}

export default function ResultsScreen({
  ministerio,
  corpo,
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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Result Card Summary */}
      <div className="bg-white border border-[#E3D9C4] rounded-xl p-4 sm:p-6 md:p-8 shadow-sm mb-4 sm:mb-8 relative overflow-hidden">
        {/* Colorful top border representing status */}
        <div className={`absolute top-0 left-0 w-full h-2 ${isApto ? "bg-[#2F9E5E]" : "bg-[#A62639]"}`} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-8">
          <div className="text-center md:text-left w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#7A7060] uppercase tracking-widest block mb-1.5 sm:mb-2">
              Resultado Oficial • {ministerio}{corpo ? ` • ${corpo}` : ""}
            </span>
            <h2 className="font-display text-lg sm:text-2xl md:text-3xl font-semibold text-[#12233F] mb-3 sm:mb-4">
              Folha de Avaliação Individual
            </h2>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4 sm:justify-start">
              <div className="bg-[#FBF7EE] border border-[#E3D9C4] rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-center">
                <span className="text-[9px] sm:text-xs text-[#7A7060] block font-medium uppercase leading-tight">Respostas</span>
                <span className="text-sm sm:text-base font-bold text-[#201C16]">
                  {Object.keys(respostas).length}/{totalPerguntas}
                </span>
              </div>
              <div className="bg-[#F2F8F1] border border-[#DCEEDF] rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-center">
                <span className="text-[9px] sm:text-xs text-[#1F5C3B] block font-medium uppercase leading-tight">Acertos</span>
                <span className="text-sm sm:text-base font-bold text-[#1F5C3B]">
                  {acertosCount}/{totalPerguntas}
                </span>
              </div>
              <div className="bg-[#FBF7EE] border border-[#E3D9C4] rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-center">
                <span className="text-[9px] sm:text-xs text-[#7A7060] block font-medium uppercase leading-tight">Aproveitamento</span>
                <span className="text-sm sm:text-base font-bold text-[#201C16]">
                  {Math.round((acertosCount / totalPerguntas) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Large Badge Area */}
          <div className="flex flex-col items-center bg-[#FBF7EE] border border-[#E3D9C4] rounded-xl p-4 sm:p-6 w-full md:w-56 text-center">
            <span className="text-[10px] sm:text-xs font-bold text-[#7A7060] uppercase tracking-wider mb-1.5 sm:mb-2">Nota Final</span>

            <div className={`text-3xl sm:text-4xl md:text-5xl font-extrabold font-mono mb-2 sm:mb-3 ${isApto ? "text-[#1F5C3B]" : "text-[#7A1E2B]"}`}>
              {notaFinal % 1 === 0 ? notaFinal : notaFinal.toFixed(1)} <span className="text-xs sm:text-sm font-semibold text-[#7A7060]">/ 20</span>
            </div>

            <div
              className={`stamp text-xs sm:text-sm ${
                isApto ? "text-[#1F5C3B]" : "text-[#7A1E2B]"
              }`}
            >
              {isApto ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apto</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>Excluído</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Buttons / Navigation back */}
      <div className="flex justify-center mb-8 sm:mb-12">
        <button
          id="btn-voltar-inicio"
          onClick={onRestart}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-[#12233F] hover:bg-[#16294A] active:bg-[#16294A] text-white px-6 py-3 sm:py-3.5 rounded-xl font-semibold shadow-md transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar ao Menu Principal</span>
        </button>
      </div>

      {/* Detailed Correction Section */}
      <div className="space-y-4 sm:space-y-6">
        <h3 className="font-display text-base sm:text-xl font-semibold text-[#12233F] flex items-center mb-3 sm:mb-4">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[#12233F] shrink-0" />
          Correção Comentada das Perguntas
        </h3>

        {perguntas.map((p, index) => {
          const userChoice = respostas[p.id];
          const isCorrect = userChoice === p.resposta;

          return (
            <div
              key={p.id}
              id={`correcao-questao-${index + 1}`}
              className="bg-white border border-[#E3D9C4] rounded-xl p-3.5 sm:p-6 shadow-xs relative overflow-hidden"
            >
              {/* Vertical side indicator strip */}
              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                userChoice === undefined 
                  ? "bg-[#D8CBB0]" 
                  : isCorrect 
                    ? "bg-[#2F9E5E]" 
                    : "bg-[#A62639]"
              }`} />

              <div className="pl-2">
                {/* Meta details */}
                <div className="flex justify-between items-center gap-2 mb-3 sm:mb-4">
                  <span className="text-[10px] sm:text-xs font-bold text-[#5C5346] uppercase tracking-wider bg-[#E3D9C4] px-2 sm:px-2.5 py-1 rounded border border-[#D8CBB0] truncate">
                    {p.categoria}
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs font-semibold text-[#7A7060]">Questão {index + 1}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                      userChoice === undefined
                        ? "bg-[#E3D9C4] text-[#5C5346]"
                        : isCorrect
                          ? "bg-[#DCEEDF] text-[#1F5C3B]"
                          : "bg-[#F5DCD9] text-[#7A1E2B]"
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
                <h4 className="text-sm sm:text-base font-semibold text-[#201C16] mb-3 sm:mb-4 leading-relaxed">
                  {p.enunciado}
                </h4>

                {/* Options representation in results */}
                <div className="space-y-2 mb-3 sm:mb-4">
                  {p.opcoes.map((opcao, optIdx) => {
                    const isSelected = userChoice === optIdx;
                    const isCorrectAnswer = p.resposta === optIdx;

                    let optionBorder = "border-[#E3D9C4]";
                    let optionBg = "bg-white";
                    let textStyle = "text-[#201C16]";
                    let badgeNode = null;

                    if (isCorrectAnswer) {
                      // Correct option is highlighted green
                      optionBorder = "border-[#2F9E5E] ring-1 ring-[#2F9E5E]";
                      optionBg = "bg-[#F2F8F1]";
                      textStyle = "text-[#1F5C3B] font-semibold";
                      badgeNode = (
                        <span className="text-[10px] sm:text-xs font-bold text-[#1F5C3B] bg-[#DCEEDF] px-2 py-0.5 rounded uppercase">
                          Gabarito Oficial
                        </span>
                      );
                    } else if (isSelected && !isCorrect) {
                      // Wrong user selection is highlighted red
                      optionBorder = "border-[#A62639] ring-1 ring-[#A62639]";
                      optionBg = "bg-[#FBF1EE]";
                      textStyle = "text-[#7A1E2B] font-semibold";
                      badgeNode = (
                        <span className="text-[10px] sm:text-xs font-bold text-[#7A1E2B] bg-[#F5DCD9] px-2 py-0.5 rounded uppercase">
                          A sua escolha
                        </span>
                      );
                    } else if (isSelected && isCorrect) {
                      // Correct user selection
                      badgeNode = (
                        <span className="text-[10px] sm:text-xs font-bold text-[#1F5C3B] bg-[#DCEEDF] px-2 py-0.5 rounded uppercase">
                          A sua escolha (Correta)
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 p-3 sm:p-3.5 rounded-xl border-2 text-xs sm:text-sm ${optionBorder} ${optionBg} ${textStyle}`}
                      >
                        <div className="flex items-start space-x-2.5 sm:space-x-3">
                          <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] uppercase ${
                            isCorrectAnswer
                              ? "bg-[#2F9E5E] text-white"
                              : isSelected
                                ? "bg-[#A62639] text-white"
                                : "bg-[#E3D9C4] text-[#5C5346]"
                          }`}>
                            {["A", "B", "C", "D"][optIdx]}
                          </span>
                          <span className="leading-tight">{opcao}</span>
                        </div>
                        {badgeNode && <div className="pl-[30px] sm:pl-0 flex-shrink-0">{badgeNode}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation block */}
                <div className="bg-[#FBF7EE] border border-[#E3D9C4] rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-[#201C16] leading-relaxed">
                  <div className="font-bold flex items-center mb-1.5 text-[#12233F] text-[10px] sm:text-xs uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-[#12233F] flex-shrink-0" />
                    Enquadramento Legal e Pedagógico
                  </div>
                  <p className="font-light text-[#5C5346]">{p.explicacao}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-8 sm:mt-12 mb-4 sm:mb-6 text-[10px] sm:text-xs text-stone-400 px-4">
        EstudaBué • MININT & MINSA • Todos os direitos reservados.
      </div>
    </div>
  );
}

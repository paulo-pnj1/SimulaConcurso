import { useState, useEffect } from "react";
import { Clock, ChevronLeft, ChevronRight, CheckSquare, HelpCircle, AlertTriangle, X, ArrowLeft, Eye, Loader2, AlertCircle } from "lucide-react";
import { Pergunta, RespostasUsuario, ConcursoType } from "../types";

interface SimulatorScreenProps {
  ministerio: ConcursoType;
  corpo?: string;
  perguntas: Pergunta[];
  respostas: RespostasUsuario;
  onSelectOption: (perguntaId: number, opcaoIndice: number) => void;
  onSubmit: (secondsElapsed: number) => void;
  onExit: () => void;
  // Modo de estudo: pede a resposta certa + explicação de UMA pergunta, a
  // qualquer momento, sem submeter a prova. `revealingId` é o id da
  // pergunta a ser pedida no momento (mostra spinner só nessa).
  onRevealAnswer: (perguntaId: number) => void;
  revealingId: number | null;
  revealError: string | null;
}

export default function SimulatorScreen({
  ministerio,
  corpo,
  perguntas,
  respostas,
  onSelectOption,
  onSubmit,
  onExit,
  onRevealAnswer,
  revealingId,
  revealError,
}: SimulatorScreenProps) {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [tempoRestante, setTempoRestante] = useState<number>(45 * 60); // 45 minutos em segundos
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  // Sair a meio da prova perde o progresso, por isso pede confirmação em
  // vez de sair diretamente ao tocar/clicar no botão "Voltar".
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  // Em telemóvel a "Folha de Respostas" fica escondida por trás de um botão
  // para não obrigar o candidato a percorrer a página só para ver o
  // enunciado; em ecrãs largos (lg+) continua sempre visível ao lado.
  const [showAnswerSheetMobile, setShowAnswerSheetMobile] = useState<boolean>(false);

  // Timer effect
  useEffect(() => {
    if (tempoRestante <= 0) {
      // Auto-submit when time is up (45 minutes)
      onSubmit(45 * 60);
      return;
    }

    const timer = setInterval(() => {
      setTempoRestante((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [tempoRestante, onSubmit]);

  const formatTime = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentPergunta = perguntas[currentIdx];
  if (!currentPergunta) return null;

  const totalPerguntas = perguntas.length;
  const respondidasCount = Object.keys(respostas).length;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === totalPerguntas - 1;

  // Modo de estudo: fica "revelada" assim que o gabarito desta pergunta
  // chega do servidor (ver App.tsx: handleRevealAnswer). Antes disso, o
  // objeto Pergunta nem tem os campos resposta/explicacao preenchidos.
  const isRevealed = currentPergunta.resposta !== undefined && currentPergunta.explicacao !== undefined;
  const isRevealingCurrent = revealingId === currentPergunta.id;

  const handleNext = () => {
    if (!isLast) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setShowConfirmModal(true);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleOptionClick = (opcaoIndex: number) => {
    onSelectOption(currentPergunta.id, opcaoIndex);
  };

  // Check if time is running out (less than 5 minutes)
  const isTimeLow = tempoRestante < 5 * 60;

  const progressPct = (respondidasCount / totalPerguntas) * 100;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 lg:pb-6">
      {/* Top Header of Simulator -  one compact strip on mobile, roomier on desktop */}
      <div className="bg-white border border-[#E3D9C4] shadow-sm rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
            <button
              id="btn-sair-simulador"
              onClick={() => setShowExitConfirm(true)}
              aria-label="Voltar"
              className="shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#E3D9C4] text-[#5C5346] hover:bg-[#FBF7EE] hover:text-[#12233F] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="inline-block max-w-full truncate p-1.5 sm:p-2 rounded-lg font-bold text-[10px] sm:text-xs bg-[#E3D9C4] text-[#12233F] uppercase tracking-wider">
                {ministerio}{corpo ? ` • ${corpo}` : ""}
              </div>
              <span className="hidden sm:inline text-xs md:text-sm font-medium text-[#5C5346] ml-3">
                {respondidasCount} de {totalPerguntas} respondidas
              </span>
            </div>
          </div>

          {/* Timer Badge */}
          <div className={`flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-4 py-1.5 rounded-xl border shrink-0 transition-colors ${
            isTimeLow 
              ? "bg-red-50 text-[#A62639] border-red-200 animate-pulse" 
              : "bg-[#FBF7EE] text-[#A62639] border-[#E3D9C4]"
          }`}>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#A62639]" />
            <span className="font-mono text-base sm:text-xl font-bold tracking-wider">{formatTime(tempoRestante)}</span>
          </div>
        </div>

        {/* Progress Bar (full width, always visible) */}
        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex-1 bg-[#E3D9C4] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300 bg-[#12233F]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="sm:hidden text-[11px] font-semibold text-[#5C5346] shrink-0">
            {respondidasCount}/{totalPerguntas}
          </span>
        </div>
      </div>

      {/* Mobile-only: quick access to the Folha de Respostas without scrolling */}
      <button
        onClick={() => setShowAnswerSheetMobile(true)}
        className="lg:hidden w-full flex items-center justify-center gap-2 bg-white border border-[#E3D9C4] text-[#12233F] text-sm font-semibold rounded-xl px-4 py-3 mb-4 shadow-sm active:bg-[#FBF7EE] transition-colors"
      >
        <CheckSquare className="w-4 h-4" />
        <span>Folha de Respostas ({respondidasCount}/{totalPerguntas})</span>
      </button>

      {/* Main 2-Column Grid */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Question area (2 cols wide on desktop) */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-white border border-[#E3D9C4] rounded-xl p-4 sm:p-6 shadow-sm lg:min-h-[500px]">
          <div>
            {/* Category and Index */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 border-b border-[#E3D9C4] pb-3 sm:pb-4">
              <span className="inline-flex items-center self-start px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-[#E3D9C4] text-[#5C5346] border border-[#D8CBB0] uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 mr-1" />
                {currentPergunta.categoria}
              </span>
              <span className="text-xs sm:text-sm font-medium text-[#7A7060]">
                Questão {currentIdx + 1} de {totalPerguntas}
              </span>
            </div>

            {/* Enunciado */}
            <h3 id={`pergunta-${currentPergunta.id}-enunciado`} className="text-base sm:text-lg md:text-xl font-medium text-[#201C16] mb-4 sm:mb-6 leading-relaxed">
              {currentPergunta.enunciado}
            </h3>

            {/* Options */}
            <div className="space-y-3.5">
              {currentPergunta.opcoes.map((opcao, idx) => {
                const isSelected = respostas[currentPergunta.id] === idx;
                const isCorrectAnswer = isRevealed && currentPergunta.resposta === idx;
                const isWrongSelected = isRevealed && isSelected && currentPergunta.resposta !== idx;

                let optionStyles = "bg-white border-[#E3D9C4] hover:bg-[#FBF7EE] hover:border-[#D8CBB0] text-[#201C16]";
                let badgeStyles = "bg-[#E3D9C4] text-[#5C5346]";
                if (isCorrectAnswer) {
                  optionStyles = "border-[#2F9E5E] ring-1 ring-[#2F9E5E] bg-[#F2F8F1] text-[#1F5C3B] font-semibold";
                  badgeStyles = "bg-[#2F9E5E] text-white";
                } else if (isWrongSelected) {
                  optionStyles = "border-[#A62639] ring-1 ring-[#A62639] bg-[#FBF1EE] text-[#7A1E2B] font-semibold";
                  badgeStyles = "bg-[#A62639] text-white";
                } else if (isSelected) {
                  optionStyles = "border-[#12233F] bg-[#EAF0F7] text-[#12233F] font-semibold";
                  badgeStyles = "bg-[#12233F] text-white";
                }

                return (
                  <button
                    key={idx}
                    id={`opcao-${idx}`}
                    onClick={() => handleOptionClick(idx)}
                    disabled={isRevealed}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-200 flex items-start space-x-3 text-sm md:text-base ${optionStyles} ${
                      isRevealed ? "cursor-default" : ""
                    }`}
                  >
                    <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-xs uppercase ${badgeStyles}`}>
                      {["A", "B", "C", "D"][idx]}
                    </span>
                    <span className="flex-1 pt-0.5 leading-tight">{opcao}</span>
                    {isCorrectAnswer && (
                      <span className="shrink-0 text-[10px] sm:text-xs font-bold text-[#1F5C3B] bg-[#DCEEDF] px-2 py-0.5 rounded uppercase">
                        Certa
                      </span>
                    )}
                    {isWrongSelected && (
                      <span className="shrink-0 text-[10px] sm:text-xs font-bold text-[#7A1E2B] bg-[#F5DCD9] px-2 py-0.5 rounded uppercase">
                        A tua escolha
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modo de estudo: ver a resposta certa desta pergunta sem
                submeter a prova toda nem terminar todas as rondas. */}
            <div className="mt-4">
              {!isRevealed ? (
                <>
                  <button
                    id="btn-ver-resposta"
                    onClick={() => onRevealAnswer(currentPergunta.id)}
                    disabled={isRevealingCurrent}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 border border-[#D8CBB0] bg-[#FBF7EE] text-[#5C5346] hover:bg-[#F2ECDD] hover:text-[#12233F] font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {isRevealingCurrent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>A obter resposta...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Ver Resposta Certa</span>
                      </>
                    )}
                  </button>
                  {revealError && revealingId === null && (
                    <p className="mt-2 text-xs text-[#A62639]">{revealError}</p>
                  )}
                </>
              ) : (
                <div className="bg-[#FBF7EE] border border-[#E3D9C4] rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-[#201C16] leading-relaxed">
                  <div className="font-bold flex items-center mb-1.5 text-[#12233F] text-[10px] sm:text-xs uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-[#12233F] shrink-0" />
                    Enquadramento Legal e Pedagógico
                  </div>
                  <p className="font-light text-[#5C5346]">{currentPergunta.explicacao}</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Controls -  desktop/tablet only; mobile uses the fixed bottom bar below */}
          <div className="hidden lg:flex items-center justify-between mt-8 border-t border-[#E3D9C4] pt-6">
            <button
              id="btn-anterior"
              onClick={handlePrev}
              className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-[#E3D9C4] text-sm font-semibold text-[#5C5346] hover:bg-[#FBF7EE] hover:border-[#D8CBB0] transition-colors ${
                isFirst ? "invisible" : ""
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              id="btn-seguinte"
              onClick={handleNext}
              className={`flex items-center space-x-1.5 px-6 py-2.5 rounded-xl font-semibold text-white shadow-sm transition-all bg-[#12233F] hover:bg-[#16294A]`}
            >
              <span>{isLast ? "Terminar e Corrigir" : "Seguinte"}</span>
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Right Column: Status Panel -  always visible on lg+, overlay on mobile/tablet */}
        <div
          className={`${
            showAnswerSheetMobile
              ? "fixed inset-0 z-50 bg-black/50 flex items-end lg:items-stretch justify-center lg:static lg:bg-transparent lg:z-auto"
              : "hidden"
          } lg:flex lg:flex-col`}
        >
          <div className="bg-white border border-[#E3D9C4] rounded-t-2xl lg:rounded-xl p-4 sm:p-6 shadow-sm flex flex-col w-full max-h-[85vh] lg:max-h-none lg:h-full justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-[#E3D9C4] pb-2">
                <h4 className="text-sm font-bold text-[#201C16] uppercase tracking-wider flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2 text-[#5C5346]" />
                  Folha de Respostas
                </h4>
                <button
                  onClick={() => setShowAnswerSheetMobile(false)}
                  className="lg:hidden p-1 text-stone-400 hover:text-[#12233F]"
                  aria-label="Fechar folha de respostas"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#7A7060] mb-4 leading-relaxed">
                Clique num número para saltar diretamente para a pergunta correspondente. Os números ficam marcados a verde quando respondidos.
              </p>

              {/* Grid of question states */}
              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 sm:gap-2.5 mb-6">
                {perguntas.map((p, index) => {
                  const isAnswered = respostas[p.id] !== undefined;
                  const isActive = index === currentIdx;

                  let btnStyles = "";
                  if (isActive) {
                    btnStyles = "border-2 border-[#12233F] bg-[#EAF0F7] text-[#12233F] font-bold shadow-sm";
                  } else if (isAnswered) {
                    btnStyles = "bg-[#2F9E5E] border-[#278A4C] text-white font-medium hover:bg-[#278A4C]";
                  } else {
                    btnStyles = "bg-white border-[#E3D9C4] text-[#7A7060] hover:bg-[#FBF7EE]";
                  }

                  return (
                    <button
                      key={p.id}
                      id={`folha-questao-${index + 1}`}
                      onClick={() => {
                        setCurrentIdx(index);
                        setShowAnswerSheetMobile(false);
                      }}
                      className={`h-11 rounded-xl text-sm border flex items-center justify-center transition-all duration-150 ${btnStyles}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#E3D9C4] pt-4 mt-2 lg:mt-6">
              <button
                id="btn-submeter-lateral"
                onClick={() => {
                  setShowAnswerSheetMobile(false);
                  setShowConfirmModal(true);
                }}
                className="w-full flex items-center justify-center space-x-2 bg-red-50 text-[#A62639] hover:bg-red-100 border border-red-200 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                <span>Submeter Exame Agora</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar -  Anterior/Seguinte fixos, como uma app nativa.
          Não aparece quando a folha de respostas está aberta em overlay. */}
      {!showAnswerSheetMobile && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E3D9C4] shadow-[0_-2px_10px_rgba(12,26,46,0.1)] px-3 py-3 flex items-center gap-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            id="btn-anterior-mobile"
            onClick={handlePrev}
            disabled={isFirst}
            aria-label="Pergunta anterior"
            className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-xl border border-[#E3D9C4] text-[#5C5346] transition-colors ${
              isFirst ? "opacity-40" : "active:bg-[#FBF7EE]"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            id="btn-seguinte-mobile"
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl font-semibold text-white shadow-sm transition-all bg-[#12233F] active:bg-[#16294A]"
          >
            <span>{isLast ? "Terminar e Corrigir" : "Seguinte"}</span>
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center space-x-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="font-display text-lg font-semibold text-stone-900">Finalizar Prova?</h3>
            </div>
            
            <p className="text-sm text-stone-500 leading-relaxed mb-6">
              {respondidasCount < totalPerguntas ? (
                <span>Ainda restam <strong>{totalPerguntas - respondidasCount} perguntas sem resposta</strong> no seu caderno de exame. Tem a certeza que deseja terminar e receber a sua nota agora?</span>
              ) : (
                <span>Parabéns! Respondeu a todas as <strong>{totalPerguntas} perguntas</strong>. Deseja submeter a prova e visualizar a correção comentada?</span>
              )}
            </p>

            <div className="flex space-x-3">
              <button
                id="btn-modal-cancelar"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 font-semibold text-stone-700 hover:bg-stone-50 transition-colors text-sm"
              >
                Voltar à Prova
              </button>
              <button
                id="btn-modal-confirmar"
                onClick={() => {
                  setShowConfirmModal(false);
                  onSubmit(45 * 60 - tempoRestante);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold text-white shadow-sm hover:shadow-rose-100 transition-all text-sm"
              >
                Sim, Submeter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal -  sair perde o progresso da prova atual */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center space-x-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="font-display text-lg font-semibold text-stone-900">Sair da Prova?</h3>
            </div>

            <p className="text-sm text-stone-500 leading-relaxed mb-6">
              Se sair agora, <strong>perde o progresso desta prova</strong> ({respondidasCount} de {totalPerguntas} respondidas) e terá de a recomeçar do início.
            </p>

            <div className="flex space-x-3">
              <button
                id="btn-exit-cancelar"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 font-semibold text-stone-700 hover:bg-stone-50 transition-colors text-sm"
              >
                Continuar Prova
              </button>
              <button
                id="btn-exit-confirmar"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold text-white shadow-sm hover:shadow-rose-100 transition-all text-sm"
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

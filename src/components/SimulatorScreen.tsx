import { useState, useEffect } from "react";
import { Clock, ChevronLeft, ChevronRight, CheckSquare, HelpCircle, AlertTriangle } from "lucide-react";
import { Pergunta, RespostasUsuario, ConcursoType } from "../types";

interface SimulatorScreenProps {
  ministerio: ConcursoType;
  perguntas: Pergunta[];
  respostas: RespostasUsuario;
  onSelectOption: (perguntaId: number, opcaoIndice: number) => void;
  onSubmit: (secondsElapsed: number) => void;
}

export default function SimulatorScreen({
  ministerio,
  perguntas,
  respostas,
  onSelectOption,
  onSubmit,
}: SimulatorScreenProps) {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [tempoRestante, setTempoRestante] = useState<number>(45 * 60); // 45 minutos em segundos
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Top Header of Simulator */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-4 mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg font-bold text-xs bg-[#E2E8F0] text-[#1A365D] uppercase tracking-wider">
            CONCURSO {ministerio}
          </div>
          <span className="text-[#E2E8F0]">|</span>
          <span className="text-xs md:text-sm font-medium text-[#475569]">
            {respondidasCount} de {totalPerguntas} perguntas respondidas
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full md:w-48 bg-[#E2E8F0] rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300 bg-[#1A365D]"
            style={{ width: `${(respondidasCount / totalPerguntas) * 100}%` }}
          />
        </div>

        {/* Timer Badge */}
        <div className={`flex items-center space-x-2.5 px-4 py-1.5 rounded-xl border transition-colors ${
          isTimeLow 
            ? "bg-red-50 text-[#C02424] border-red-200 animate-pulse" 
            : "bg-[#F8FAFC] text-[#C02424] border-[#E2E8F0]"
        }`}>
          <Clock className="w-4 h-4 text-[#C02424]" />
          <span className="font-mono text-xl font-bold tracking-wider">{formatTime(tempoRestante)}</span>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Question area (2 cols wide on desktop) */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-sm min-h-[500px]">
          <div>
            {/* Category and Index */}
            <div className="flex justify-between items-center mb-6 border-b border-[#E2E8F0] pb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#E2E8F0] text-[#475569] border border-[#CBD5E1] uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 mr-1" />
                {currentPergunta.categoria}
              </span>
              <span className="text-sm font-medium text-[#64748B]">
                Questão {currentIdx + 1} de {totalPerguntas}
              </span>
            </div>

            {/* Enunciado */}
            <h3 id={`pergunta-${currentPergunta.id}-enunciado`} className="text-lg md:text-xl font-medium text-[#1C1E21] mb-6 leading-relaxed">
              {currentPergunta.enunciado}
            </h3>

            {/* Options */}
            <div className="space-y-3.5">
              {currentPergunta.opcoes.map((opcao, idx) => {
                const isSelected = respostas[currentPergunta.id] === idx;
                return (
                  <button
                    key={idx}
                    id={`opcao-${idx}`}
                    onClick={() => handleOptionClick(idx)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-200 flex items-start space-x-3 text-sm md:text-base ${
                      isSelected
                        ? "border-[#1A365D] bg-[#EFF6FF] text-[#1A365D] font-semibold"
                        : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] text-[#1C1E21]"
                    }`}
                  >
                    <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                      isSelected
                        ? "bg-[#1A365D] text-white"
                        : "bg-[#E2E8F0] text-[#475569]"
                    }`}>
                      {["A", "B", "C", "D"][idx]}
                    </span>
                    <span className="flex-1 pt-0.5 leading-tight">{opcao}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 border-t border-[#E2E8F0] pt-6">
            <button
              id="btn-anterior"
              onClick={handlePrev}
              className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors ${
                isFirst ? "invisible" : ""
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              id="btn-seguinte"
              onClick={handleNext}
              className={`flex items-center space-x-1.5 px-6 py-2.5 rounded-xl font-semibold text-white shadow-sm transition-all bg-[#1A365D] hover:bg-[#152c4a]`}
            >
              <span>{isLast ? "Terminar e Corrigir" : "Seguinte"}</span>
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Right Column: Status Panel (1 col wide on desktop) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-sm flex flex-col h-full justify-between">
          <div>
            <h4 className="text-sm font-bold text-[#1C1E21] uppercase tracking-wider mb-4 flex items-center border-b border-[#E2E8F0] pb-2">
              <CheckSquare className="w-4 h-4 mr-2 text-[#475569]" />
              Folha de Respostas
            </h4>
            <p className="text-xs text-[#64748B] mb-4 leading-relaxed">
              Clique num número para saltar diretamente para a pergunta correspondente. Os números ficam marcados a verde quando respondidos.
            </p>

            {/* Grid of question states */}
            <div className="grid grid-cols-5 gap-2.5 mb-6">
              {perguntas.map((p, index) => {
                const isAnswered = respostas[p.id] !== undefined;
                const isActive = index === currentIdx;

                let btnStyles = "";
                if (isActive) {
                  btnStyles = "border-2 border-[#1A365D] bg-blue-50 text-[#1A365D] font-bold shadow-sm";
                } else if (isAnswered) {
                  btnStyles = "bg-[#22C55E] border-[#16A34A] text-white font-medium hover:bg-[#16A34A]";
                } else {
                  btnStyles = "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]";
                }

                return (
                  <button
                    key={p.id}
                    id={`folha-questao-${index + 1}`}
                    onClick={() => setCurrentIdx(index)}
                    className={`h-11 rounded-xl text-sm border flex items-center justify-center transition-all duration-150 ${btnStyles}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4 mt-6">
            <button
              id="btn-submeter-lateral"
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center justify-center space-x-2 bg-red-50 text-[#C02424] hover:bg-red-100 border border-red-200 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              <span>Submeter Exame Agora</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center space-x-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold text-gray-900">Finalizar Simulação?</h3>
            </div>
            
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
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
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-sm"
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
    </div>
  );
}

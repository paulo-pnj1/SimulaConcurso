import React from "react";
import { ArrowLeft, ChevronRight, Shield, Fingerprint, Globe2, Building2, Flame } from "lucide-react";
import { CORPOS_MININT, CorpoMinint } from "../types";
import { motion } from "motion/react";

interface CorpoSelectionScreenProps {
  onSelect: (corpo: CorpoMinint) => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

// Um ícone distinto por corpo, na mesma ordem de CORPOS_MININT (types.ts).
const CORPO_ICONS: Record<CorpoMinint, React.ElementType> = {
  "Polícia Nacional": Shield,
  "Serviço de Investigação Criminal (SIC)": Fingerprint,
  "Serviço de Migração e Estrangeiros (SME)": Globe2,
  "Serviço Penitenciário": Building2,
  "Proteção Civil e Bombeiros": Flame,
};

export default function CorpoSelectionScreen({
  onSelect,
  onBack,
  isLoading,
  error,
}: CorpoSelectionScreenProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="mb-6 text-stone-500 hover:text-[#12233F] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Voltar à seleção de Ministério</span>
      </button>

      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center space-x-2 bg-[#D9E4F0] text-[#12233F] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-[#C3D4E8]">
          <Shield className="w-4 h-4" />
          <span>Ministério do Interior</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-[#12233F] mb-4">
          Selecione o Corpo / Serviço
        </h1>
        <p className="text-sm md:text-base text-[#7A7060] max-w-2xl mx-auto leading-relaxed">
          O caderno de perguntas inclui matérias gerais (Constituição, legislação orgânica, etc.)
          combinadas com perguntas específicas do corpo escolhido.
        </p>
      </div>

      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 text-red-800 rounded-xl p-6 text-sm max-w-2xl mx-auto">
          <div className="font-semibold flex items-center mb-2 text-base text-red-900">
            <span>⚠️ Erro ao Carregar Perguntas</span>
          </div>
          <p className="mb-3 leading-relaxed">{error}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {CORPOS_MININT.map((corpo) => {
          const Icon = CORPO_ICONS[corpo.id];
          return (
            <motion.button
              key={corpo.id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelect(corpo.id)}
              disabled={isLoading}
              className="group flex flex-col text-left bg-white border border-[#E3D9C4] hover:border-[#12233F] rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 disabled:opacity-50 relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#12233F]" />
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-stone-100 text-[#12233F] rounded-xl group-hover:bg-[#12233F] group-hover:text-white transition-colors duration-300">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-[#12233F] tracking-wider bg-stone-100 px-2.5 py-1 rounded-full uppercase">
                  {corpo.sigla}
                </span>
              </div>
              <h2 className="font-display text-lg font-semibold text-[#12233F] mb-1.5">
                {corpo.id}
              </h2>
              <p className="text-xs text-[#7A7060] leading-relaxed mb-4 flex-grow">
                {corpo.descricao}
              </p>
              <div className="flex items-center text-sm font-semibold text-[#12233F] mt-auto">
                <span>Iniciar Simulação</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-8 text-center text-stone-500 animate-pulse text-sm">
          A carregar caderno de perguntas oficiais...
        </div>
      )}
    </div>
  );
}

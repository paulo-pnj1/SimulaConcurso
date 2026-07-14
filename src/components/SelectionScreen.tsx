import React, { useState } from "react";
import {
  Shield,
  HeartPulse,
  BookOpen,
  GraduationCap,
  ChevronRight,
  User,
  LogOut,
  Award,
  Clock,
  Calendar,
  Lock,
  CheckCircle,
  XCircle,
  Sparkles,
  Copy,
  MessageCircle,
  RefreshCw
} from "lucide-react";
import { ConcursoType, UserProfile, PREMIUM_CONFIG } from "../types";
import { motion } from "motion/react";

interface SelectionScreenProps {
  currentUser: UserProfile | null;
  onSignOut: () => void;
  onSelect: (type: ConcursoType) => void;
  isLoading: boolean;
  error: string | null;
  onOpenManage: () => void;
  userResults: any[];
  loadingResults: boolean;
  onRefreshPremiumStatus?: () => Promise<void>;
}

export default function SelectionScreen({
  currentUser,
  onSignOut,
  onSelect,
  isLoading,
  error,
  onOpenManage,
  userResults,
  loadingResults,
  onRefreshPremiumStatus,
}: SelectionScreenProps) {
  const isAdmin = currentUser?.role === "admin";
  const isPremium = isAdmin || currentUser?.isPremium === true;
  const [showPayInfo, setShowPayInfo] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleCheckStatus = async () => {
    if (!onRefreshPremiumStatus) return;
    setCheckingStatus(true);
    await onRefreshPremiumStatus();
    setCheckingStatus(false);
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Fiz o pagamento de ${PREMIUM_CONFIG.priceLabel} para ativar o acesso Premium do Simulador de Exames Angola.\nNome: ${currentUser?.name || ""}\nEmail: ${currentUser?.email || ""}\nEnvio o comprovativo em anexo.`
  );
  const whatsappLink = `https://wa.me/${PREMIUM_CONFIG.whatsappAdmin}?text=${whatsappMessage}`;

  const formatTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header Bar */}
      {currentUser && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-10 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isAdmin ? "bg-red-50 text-[#C02424]" : "bg-blue-50 text-[#1A365D]"
            }`}>
              {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">{currentUser.name}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isAdmin ? "bg-red-100 text-[#C02424]" : "bg-blue-100 text-[#1A365D]"
                }`}>
                  {isAdmin ? "Administrador" : "Candidato"}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">{currentUser.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={onOpenManage}
                className="bg-[#1A365D] hover:bg-[#122744] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Painel Administrativo</span>
              </button>
            )}

            <button
              onClick={onSignOut}
              className="text-slate-500 hover:text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-[#CBD5E1] hover:border-red-100 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}

      {/* Institutional Header */}
      <div className="text-center mb-10 md:mb-12">
        <div className="inline-flex items-center justify-center space-x-2 bg-[#E2E8F0] text-[#475569] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-[#CBD5E1]">
          <GraduationCap className="w-4 h-4" />
          <span>Portal de Preparação Oficial</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-sans font-extrabold tracking-tight text-[#1A365D] mb-4">
          Selecione o Ministério do Concurso
        </h1>
        <p className="text-sm md:text-base text-[#64748B] max-w-2xl mx-auto leading-relaxed">
          Prepare-se para os concursos públicos de ingresso na Função Pública de Angola. Teste os seus conhecimentos com a nossa simulação de exames oficiais de admissão.
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

      {/* Premium Upsell / Status Card */}
      {!isAdmin && currentUser && (
        <div className="max-w-3xl mx-auto mb-10">
          {isPremium ? (
            <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Acesso Premium ativo — banco completo de perguntas e simulações ilimitadas.</span>
            </div>
          ) : (
            <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Desbloqueie o Acesso Premium</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Neste momento só tem acesso a uma amostra gratuita de perguntas por ministério.
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-2xl font-extrabold text-[#1A365D]">{PREMIUM_CONFIG.priceLabel}</span>
                  <p className="text-[10px] text-slate-400 -mt-0.5">pagamento único • acesso vitalício</p>
                </div>
              </div>

              <ul className="grid sm:grid-cols-2 gap-2 mb-5">
                {[
                  "Banco completo de perguntas MININT e MINSA",
                  "Simulações ilimitadas, sem restrições",
                  "Histórico completo de classificações",
                  "Explicações detalhadas de cada resposta",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {!showPayInfo ? (
                <button
                  onClick={() => setShowPayInfo(true)}
                  className="w-full bg-[#1A365D] hover:bg-[#122744] text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer"
                >
                  Ver Instruções de Pagamento
                </button>
              ) : (
                <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Efetue o pagamento de <strong>{PREMIUM_CONFIG.priceLabel}</strong> por{" "}
                    <strong>Multicaixa Express</strong> ou transferência bancária, depois envie o comprovativo
                    pelo WhatsApp para ativarmos o seu acesso.
                  </p>

                  <div className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Multicaixa Express</span>
                      <span className="text-sm font-bold text-slate-800">{PREMIUM_CONFIG.multicaixaExpressNumber}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(PREMIUM_CONFIG.multicaixaExpressNumber, "mcx")}
                      className="text-[10px] font-bold text-[#1A365D] flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> {copiedField === "mcx" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">IBAN / Titular</span>
                      <span className="text-xs font-bold text-slate-800">{PREMIUM_CONFIG.ibanTransferencia}</span>
                      <span className="text-[10px] text-slate-500 block">{PREMIUM_CONFIG.nomeTitular}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(PREMIUM_CONFIG.ibanTransferencia, "iban")}
                      className="text-[10px] font-bold text-[#1A365D] flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> {copiedField === "iban" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>

                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Já Paguei — Enviar Comprovativo no WhatsApp
                  </a>

                  <button
                    onClick={handleCheckStatus}
                    disabled={checkingStatus}
                    className="w-full text-[#1A365D] text-xs font-bold py-2 rounded-xl border border-[#CBD5E1] hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
                    {checkingStatus ? "A verificar..." : "Já fui aprovado, verificar acesso"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid of ministries */}
      <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {/* MININT Card */}
        <motion.button
          id="card-minint"
          whileHover={{ y: -5 }}
          transition={{ duration: 0.2 }}
          onClick={() => onSelect("MININT")}
          disabled={isLoading}
          className="group flex flex-col text-left bg-white border border-[#E2E8F0] hover:border-[#1A365D] rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 disabled:opacity-50 relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1A365D]" />
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-slate-100 text-[#1A365D] rounded-xl group-hover:bg-[#1A365D] group-hover:text-white transition-colors duration-300">
              <Shield className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold text-[#1A365D] tracking-wider bg-slate-100 px-3 py-1 rounded-full uppercase">
              MININT
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-[#1A365D] mb-2">
            Ministério do Interior
          </h2>
          <p className="text-sm text-[#64748B] leading-relaxed mb-6 flex-grow">
            Exames para a Polícia Nacional, Serviço de Investigação Criminal (SIC), Migração e Estrangeiros (SME) e Proteção Civil. Incide sobre a Constituição da República, Legislação Policial e Deontologia.
          </p>
          <div className="flex items-center text-sm font-semibold text-[#1A365D] mt-auto">
            <span>Iniciar Simulação</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* MINSA Card */}
        <motion.button
          id="card-minsa"
          whileHover={{ y: -5 }}
          transition={{ duration: 0.2 }}
          onClick={() => onSelect("MINSA")}
          disabled={isLoading}
          className="group flex flex-col text-left bg-white border border-[#E2E8F0] hover:border-[#1A365D] rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 disabled:opacity-50 relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#C02424]" />
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-slate-100 text-[#C02424] rounded-xl group-hover:bg-[#1A365D] group-hover:text-white transition-colors duration-300">
              <HeartPulse className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold text-[#C02424] tracking-wider bg-red-50 px-3 py-1 rounded-full uppercase">
              MINSA
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-[#1A365D] mb-2">
            Ministério da Saúde
          </h2>
          <p className="text-sm text-[#64748B] leading-relaxed mb-6 flex-grow">
            Exames para Médicos, Enfermeiros, Técnicos de Diagnóstico e Terapeutas. Incide sobre o Serviço Nacional de Saúde (SNS), Saúde Pública de Angola, Epidemiologia, Ética e Cuidados de Saúde Primários.
          </p>
          <div className="flex items-center text-sm font-semibold text-[#1A365D] mt-auto">
            <span>Iniciar Simulação</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </div>

      {isLoading && (
        <div className="mt-8 text-center text-gray-500 animate-pulse text-sm">
          A carregar caderno de perguntas oficiais...
        </div>
      )}

      {/* Candidate History Section */}
      {!isAdmin && currentUser && (
        <div className="mt-12 max-w-3xl mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <h2 className="text-lg font-bold text-[#1A365D] mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-5 h-5 text-slate-500" />
            As Minhas Simulações Recentes (Base de Dados)
          </h2>

          {loadingResults ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-500 mx-auto mb-2"></div>
              <span>A ler histórico de classificações...</span>
            </div>
          ) : userResults.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 leading-normal">
                Ainda não completou nenhuma simulação de concurso. As suas notas aparecerão gravadas permanentemente aqui assim que terminar um exame.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {userResults.slice(0, 5).map((res) => {
                const isPassed = res.score >= 50;
                return (
                  <div
                    key={res.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 border border-[#E2E8F0] rounded-xl hover:border-slate-300 transition-colors bg-slate-50/50 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs ${
                        isPassed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {res.score}%
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            res.ministerio === "MININT" ? "bg-blue-100 text-[#1A365D]" : "bg-red-100 text-[#C02424]"
                          }`}>
                            {res.ministerio}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTempo(res.tempoGasto)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1 flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(res.createdAt).toLocaleDateString("pt-AO", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        isPassed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {isPassed ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Aprovado (Apto)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-600" />
                            <span>Reprovado</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Secondary info / Footer decor */}
      <div className="mt-16 md:mt-20 text-center border-t border-gray-100 pt-8 max-w-lg mx-auto">
        <p className="text-xs text-gray-400">
          República de Angola • Ministério da Administração do Território • Escola de Formação de Quadros
        </p>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import {
  Lock,
  Sparkles,
  CheckCircle,
  Copy,
  MessageCircle,
  RefreshCw,
  LogOut,
  Clock3,
} from "lucide-react";
import { UserProfile, PREMIUM_CONFIG } from "../types";

interface PaymentGateScreenProps {
  currentUser: UserProfile;
  onSignOut: () => void;
  onMarkPending: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
}

// Ecrã de bloqueio: aparece a qualquer candidato que ainda não tenha o
// acesso Premium ativado. Substitui por completo a seleção de ministério e
// o simulador -  só depois do admin confirmar o pagamento é que o candidato
// passa a ver o resto da aplicação.
export default function PaymentGateScreen({
  currentUser,
  onSignOut,
  onMarkPending,
  onRefreshStatus,
}: PaymentGateScreenProps) {
  const [showPayInfo, setShowPayInfo] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [markingPending, setMarkingPending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const isPending = currentUser.paymentStatus === "pending";

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Fiz o pagamento de ${PREMIUM_CONFIG.priceLabel} para ativar o acesso ao EstudaBué.\nNome: ${currentUser.name}\nNúmero registado: ${currentUser.telefone || ""}\nEnvio o comprovativo em anexo.`
  );
  const whatsappLink = `https://wa.me/${PREMIUM_CONFIG.whatsappAdmin}?text=${whatsappMessage}`;

  const handleAlreadyPaidClick = async () => {
    setMarkingPending(true);
    try {
      await onMarkPending();
    } finally {
      setMarkingPending(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      await onRefreshStatus();
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-12">
      <div className="bg-white border border-[#E3D9C4] border-t-4 border-t-[#C89B3C] rounded-2xl p-5 sm:p-8 shadow-md">
        {/* Profile strip */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <span className="font-bold text-stone-800 text-sm block">{currentUser.name}</span>
            <span className="text-[10px] text-stone-400">{currentUser.telefone || currentUser.email}</span>
          </div>
          <button
            onClick={onSignOut}
            className="text-stone-500 hover:text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-[#D8CBB0] hover:border-red-100 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>

        {isPending ? (
          // Estado: já disse que pagou, aguarda verificação manual do admin
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-amber-600 bg-amber-50 mb-5">
              <Clock3 className="w-8 h-8" />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[#12233F] mb-2">
              A sua conta será ativada em breve
            </h2>
            <p className="text-sm text-[#7A7060] leading-relaxed mb-6">
              Recebemos a sua confirmação de pagamento. Aguarde -  o administrador vai verificar se o número de
              telemóvel com que se registou (<strong>{currentUser.telefone || "não indicado"}</strong>) corresponde
              ao número do ordenante da transferência Multicaixa Express, e depois ativa o seu acesso manualmente.
            </p>
            <button
              onClick={handleCheckStatus}
              disabled={checkingStatus}
              className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white text-sm font-bold py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? "animate-spin" : ""}`} />
              {checkingStatus ? "A verificar..." : "Já fui ativado, verificar acesso"}
            </button>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full text-[#12233F] text-xs font-bold py-2.5 rounded-xl border border-[#D8CBB0] hover:bg-stone-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Reenviar comprovativo pelo WhatsApp
            </a>
          </div>
        ) : (
          // Estado: ainda não pagou -  ecrã de bloqueio com instruções
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[#12233F] border-2 border-[#12233F] mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-[#12233F] mb-2">
                Acesso Bloqueado
              </h2>
              <p className="text-sm text-[#7A7060] leading-relaxed">
                Para aceder aos estudos e testes de treino de MININT e MINSA, ative o seu acesso com um
                pagamento único.
              </p>
            </div>

            <div className="text-center mb-6">
              <span className="text-3xl font-extrabold text-[#12233F]">{PREMIUM_CONFIG.priceLabel}</span>
              <p className="text-[11px] text-stone-400 -mt-0.5">pagamento único • acesso vitalício</p>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                "Banco completo de perguntas MININT e MINSA",
                "Testes de treino ilimitados, sem restrições",
                "Histórico completo de classificações",
                "Explicações detalhadas de cada resposta",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-stone-600">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {!showPayInfo ? (
              <button
                onClick={() => setShowPayInfo(true)}
                className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white text-sm font-bold py-3 rounded-xl transition-all cursor-pointer"
              >
                Ver Instruções de Pagamento
              </button>
            ) : (
              <div className="bg-stone-50 border border-[#E3D9C4] rounded-xl p-4 space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Efetue o pagamento de <strong>{PREMIUM_CONFIG.priceLabel}</strong> por{" "}
                  <strong>Multicaixa Express</strong> com o número de telemóvel abaixo, a partir do número com que
                  se registou (<strong>{currentUser.telefone || "não indicado"}</strong>).
                </p>

                <div className="flex items-center justify-between bg-white border border-[#E3D9C4] rounded-lg px-3 py-2">
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 uppercase block">Multicaixa Express</span>
                    <span className="text-sm font-bold text-stone-800">{PREMIUM_CONFIG.multicaixaExpressNumber}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(PREMIUM_CONFIG.multicaixaExpressNumber, "mcx")}
                    className="text-[10px] font-bold text-[#12233F] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> {copiedField === "mcx" ? "Copiado!" : "Copiar"}
                  </button>
                </div>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar Comprovativo no WhatsApp
                </a>

                <button
                  onClick={handleAlreadyPaidClick}
                  disabled={markingPending}
                  className="w-full text-[#12233F] text-xs font-bold py-2.5 rounded-xl border border-[#D8CBB0] hover:bg-stone-50 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${markingPending ? "animate-pulse" : ""}`} />
                  {markingPending ? "A confirmar..." : "Já Paguei"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

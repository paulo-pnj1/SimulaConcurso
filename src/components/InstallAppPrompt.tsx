import React, { useEffect, useState } from "react";
import { Download, Share, X, SquarePlus } from "lucide-react";

// Evento não-standard do browser (Chrome/Android/Edge/desktop) que permite
// mostrar o diálogo nativo de instalação. O TypeScript não o conhece por
// omissão, por isso declaramos o mínimo que precisamos aqui.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

const DISMISSED_KEY = "installPromptDismissedAt";
const DISMISS_DAYS = 14;

function wasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return days < DISMISS_DAYS;
}

// Banner discreto que convida o candidato a instalar a app no telemóvel:
// - Android/Chrome/Edge/desktop: usa o evento beforeinstallprompt (botão
//   "Instalar" nativo do browser).
// - iOS Safari: não tem esse evento, por isso mostramos instruções manuais
//   (Partilhar -> Adicionar ao Ecrã Principal), que é o único caminho no iPhone.
export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // No iOS não existe beforeinstallprompt: mostramos instruções manuais.
    if (isIos()) {
      setShowIosInstructions(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
      <div className="bg-[#12233F] text-white rounded-2xl shadow-xl border border-[#c89b3c]/40 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          {showIosInstructions ? <Share className="w-5 h-5 text-[#c89b3c]" /> : <Download className="w-5 h-5 text-[#c89b3c]" />}
        </div>

        <div className="flex-grow min-w-0">
          <p className="font-bold text-sm">Instalar a app no telemóvel</p>
          {showIosInstructions ? (
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              Toque em <Share className="w-3 h-3 inline -mt-0.5" /> <strong>Partilhar</strong>, depois em{" "}
              <SquarePlus className="w-3 h-3 inline -mt-0.5" /> <strong>"Adicionar ao Ecrã Principal"</strong>.
            </p>
          ) : (
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              Aceda mais rápido, mesmo com internet fraca. Sem ocupar espaço de uma app da loja.
            </p>
          )}

          {!showIosInstructions && (
            <button
              onClick={handleInstallClick}
              className="mt-3 bg-[#c89b3c] hover:bg-[#96721f] text-[#0C1A2E] text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Instalar agora
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="text-white/50 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Pergunta, ConcursoType, CorpoMinint, RespostasUsuario, UserProfile, Resultado, SubmitExamResponse, RevealAnswerResponse } from "./types";
import SelectionScreen from "./components/SelectionScreen";
import CorpoSelectionScreen from "./components/CorpoSelectionScreen";
import SimulatorScreen from "./components/SimulatorScreen";
import ResultsScreen from "./components/ResultsScreen";
import AuthScreen from "./components/AuthScreen";
import AdminDashboard from "./components/AdminDashboard";
import PaymentGateScreen from "./components/PaymentGateScreen";
import ManualsScreen from "./components/ManualsScreen";
import InstallAppPrompt from "./components/InstallAppPrompt";
import { GraduationCap, Home, BookOpen, LogOut, ShieldCheck } from "lucide-react";
import { auth, db, getExamQuestionsFn, submitExamFn, revealAnswerFn } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { isAdminEmail } from "./config/admin";

type ScreenType = "auth" | "selection" | "corpo-selection" | "simulator" | "results" | "manage" | "manuais";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("auth");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [selectedMinisterio, setSelectedMinisterio] = useState<ConcursoType | null>(null);
  const [selectedCorpo, setSelectedCorpo] = useState<CorpoMinint | null>(null);
  const [perguntasFiltro, setPerguntasFiltro] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<RespostasUsuario>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modo de estudo dentro do simulador: candidato pede para ver a resposta
  // certa de uma pergunta específica, a qualquer momento, sem submeter a
  // prova toda nem terminar todas as rondas.
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Candidate Exam History
  const [userResults, setUserResults] = useState<Resultado[]>([]);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);

  // Track Auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setIsLoading(true);
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          const role = isAdminEmail(user.email) ? "admin" : "candidate";

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (role === "candidate" && !data.telefone) {
              // Registo incompleto (falta o número de telemóvel). Volta ao
              // ecrã de autenticação, que trata desse passo antes de entrar.
              await signOut(auth);
              setCurrentUser(null);
              setScreen("auth");
              return;
            }
            setCurrentUser({
              uid: user.uid,
              name: data.name || user.displayName || user.email.split("@")[0],
              email: user.email,
              telefone: data.telefone,
              role: data.role || role,
              isPremium: data.isPremium === true,
              paymentStatus: data.paymentStatus || "none",
              premiumActivatedAt: data.premiumActivatedAt,
            });
            setScreen("selection");
          } else if (role === "admin") {
            // Conta de administrador pré-configurada manualmente no Firebase;
            // se ainda não tiver documento, funciona em modo só-leitura local.
            setCurrentUser({
              uid: user.uid,
              name: user.displayName || user.email.split("@")[0],
              email: user.email,
              role: "admin",
              isPremium: true,
              paymentStatus: "none",
            });
            setScreen("selection");
          } else {
            // Candidato sem documento (nunca completou o registo do
            // telemóvel). Volta ao ecrã de autenticação para o fazer.
            await signOut(auth);
            setCurrentUser(null);
            setScreen("auth");
          }
        } catch (e) {
          console.error("Erro ao carregar perfil do utilizador:", e);
          setCurrentUser({
            uid: user.uid,
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            role: isAdminEmail(user.email) ? "admin" : "candidate",
            isPremium: false,
            paymentStatus: "none",
          });
          setScreen("selection");
        } finally {
          setIsLoading(false);
        }
      } else {
        setCurrentUser(null);
        setScreen("auth");
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch results for logged-in candidate
  const fetchUserResults = async (uid: string) => {
    setLoadingResults(true);
    try {
      const resultsRef = collection(db, "resultados");
      const resultsQuery = query(resultsRef, where("candidateUid", "==", uid));
      const snapshot = await getDocs(resultsQuery);
      const fetched: Resultado[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({ id: docSnap.id, ...data } as Resultado);
      });
      // Sort newest first
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUserResults(fetched);
    } catch (err) {
      console.error("Erro ao carregar histórico do candidato:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserResults(currentUser.uid);
    } else {
      setUserResults([]);
    }
  }, [currentUser]);

  // MININT tem corpos (Polícia Nacional, SIC, SME, Serviço Penitenciário,
  // Proteção Civil e Bombeiros) que precisam de ser escolhidos antes do
  // exame; MINSA não tem essa subdivisão e vai direto para o simulador.
  const handleSelectMinistry = async (ministerio: ConcursoType) => {
    setError(null);
    if (ministerio === "MININT") {
      setSelectedMinisterio(ministerio);
      setScreen("corpo-selection");
      return;
    }
    await fetchExamQuestions(ministerio);
  };

  const handleSelectCorpo = async (corpo: CorpoMinint) => {
    setSelectedCorpo(corpo);
    await fetchExamQuestions("MININT", corpo);
  };

  const fetchExamQuestions = async (ministerio: ConcursoType, corpo?: CorpoMinint) => {
    setIsLoading(true);
    setError(null);

    try {
      // Questions come from the getExamQuestions Cloud Function, which
      // strips `resposta`/`explicacao` server-side and applies the trial
      // limit for non-premium candidates. This is what stops anyone from
      // reading the answer key out of the network tab before answering.
      const response = await getExamQuestionsFn({ ministerio, corpo });
      const { perguntas } = response.data as { perguntas: Pergunta[] };

      setPerguntasFiltro(perguntas);
      setSelectedMinisterio(ministerio);
      setRespostas({}); // Reset answers
      setScreen("simulator");
    } catch (err: any) {
      console.error("Erro ao carregar perguntas:", err);
      setError(err.message || "Erro de rede ou permissão ao obter perguntas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (perguntaId: number, opcaoIndice: number) => {
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: opcaoIndice,
    }));
  };

  // On submit, ask the submitExam Cloud Function to grade the exam
  // server-side (it holds the answer key; the client never does) and
  // persist the result. The function also returns the correct answers for
  // the questions actually shown, which we merge back into perguntasFiltro
  // so ResultsScreen can render the review (correct option + explicacao).
  const handleSubmitExam = async (secondsElapsed: number) => {
    if (!currentUser || !selectedMinisterio) {
      setScreen("results");
      return;
    }

    try {
      const response = await submitExamFn({
        ministerio: selectedMinisterio,
        corpo: selectedCorpo || undefined,
        respostas,
        secondsElapsed,
      });
      const { revisao } = response.data as SubmitExamResponse;

      const revisaoById = new Map(revisao.map((r) => [r.id, r]));
      setPerguntasFiltro((prev) =>
        prev.map((p) => {
          const r = revisaoById.get(p.id);
          return r ? { ...p, resposta: r.resposta, explicacao: r.explicacao } : p;
        })
      );

      fetchUserResults(currentUser.uid);
    } catch (err: any) {
      console.error("Erro ao submeter exame:", err);
      setError(err.message || "Não foi possível submeter o exame. Tente novamente.");
    } finally {
      setScreen("results");
    }
  };

  // Candidato em modo de estudo pede para ver o gabarito de UMA pergunta,
  // sem submeter a prova nem terminar todas as rondas. Só a pergunta
  // pedida fica com resposta/explicacao preenchidas em perguntasFiltro; as
  // restantes continuam "por revelar" até serem pedidas ou até o exame ser
  // submetido normalmente.
  const handleRevealAnswer = async (perguntaId: number) => {
    if (!selectedMinisterio) return;
    setRevealError(null);
    setRevealingId(perguntaId);
    try {
      const response = await revealAnswerFn({
        ministerio: selectedMinisterio,
        corpo: selectedCorpo || undefined,
        perguntaId,
      });
      const { resposta, explicacao } = response.data as RevealAnswerResponse;
      setPerguntasFiltro((prev) =>
        prev.map((p) => (p.id === perguntaId ? { ...p, resposta, explicacao } : p))
      );
    } catch (err: any) {
      console.error("Erro ao revelar resposta:", err);
      setRevealError(err.message || "Não foi possível obter a resposta certa. Tente novamente.");
    } finally {
      setRevealingId(null);
    }
  };

  const handleRestart = () => {
    setSelectedMinisterio(null);
    setSelectedCorpo(null);
    setPerguntasFiltro([]);
    setRespostas({});
    setRevealError(null);
    setScreen("selection");
  };

  const handleBackToMinistrySelection = () => {
    setSelectedMinisterio(null);
    setError(null);
    setScreen("selection");
  };

  // Sair do simulador a meio da prova: descarta as respostas e perguntas
  // carregadas e volta ao ecrã de seleção de corpo (se era MININT) ou à
  // seleção de ministério, tal como um "voltar" normal faria.
  const handleExitSimulator = () => {
    setPerguntasFiltro([]);
    setRespostas({});
    setRevealError(null);
    if (selectedMinisterio === "MININT") {
      setSelectedCorpo(null);
      setScreen("corpo-selection");
    } else {
      setSelectedMinisterio(null);
      setScreen("selection");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setScreen("auth");
    } catch (e) {
      console.error("Erro no logout:", e);
    }
  };

  const handleAuthSuccess = (userProfile: UserProfile) => {
    setCurrentUser(userProfile);
    setScreen("selection");
  };

  // Permite ao candidato verificar se o Admin já ativou o seu acesso Premium
  const handleRefreshPremiumStatus = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                isPremium: data.isPremium === true,
                paymentStatus: data.paymentStatus || "none",
                premiumActivatedAt: data.premiumActivatedAt,
              }
            : prev
        );
      }
    } catch (e) {
      console.error("Erro ao verificar estado Premium:", e);
    }
  };

  // O candidato clica em "Já Paguei": deixamos um sinal em Firestore para o
  // admin saber que há um comprovativo a caminho pelo WhatsApp, e mostramos
  // a mensagem de "aguarde, vamos verificar e ativar".
  const handleMarkPaymentPending = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, { paymentStatus: "pending", pendingSince: new Date().toISOString() }, { merge: true });
      setCurrentUser((prev) => (prev ? { ...prev, paymentStatus: "pending", pendingSince: new Date().toISOString() } : prev));
    } catch (e) {
      console.error("Erro ao registar pedido de ativação:", e);
    }
  };

  // Barra de navegação inferior (estilo app nativa) só faz sentido nos
  // ecrãs "hub" do candidato - não durante o fluxo de prova/pagamento,
  // onde já existe um botão "Voltar" próprio e dedicado.
  const isAdminUser = currentUser?.role === "admin";
  const hasHubAccess = !!currentUser && (isAdminUser || currentUser.isPremium);
  const showBottomNav = hasHubAccess && (screen === "selection" || screen === "manuais" || screen === "manage");

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col justify-between text-[var(--color-ink)]">
      {/* Top Main Navbar */}
      <header className="bg-[var(--color-navy)] text-white border-b-2 border-[var(--color-gold)] sticky top-0 z-40 shadow-[0_2px_10px_rgba(12,26,46,0.25)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group min-w-0" onClick={handleRestart}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 border border-white/25 rounded-full flex items-center justify-center text-[var(--color-gold)] group-hover:border-[var(--color-gold)] transition-colors">
              <GraduationCap className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-semibold text-sm sm:text-base md:text-lg text-white tracking-tight block leading-none truncate">
                EstudaBué
              </span>
              <span className="hidden sm:block text-[10px] font-semibold text-white/60 uppercase tracking-[0.2em] mt-1">
                Função Pública de Angola
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Angola Colors Ribbon representation */}
            <div className="flex space-x-1">
              <span className="w-2 h-4 bg-[var(--color-red)] rounded-sm" />
              <span className="w-2 h-4 bg-[var(--color-gold)] rounded-sm" />
              <span className="w-2 h-4 bg-black rounded-sm" />
            </div>
            <span className="text-xs font-semibold text-white/70 hidden sm:inline-block tracking-wide">
              MININT / MINSA
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-grow ${showBottomNav ? "pb-20 md:pb-0" : ""}`}>
        {screen === "auth" && <AuthScreen onAuthSuccess={handleAuthSuccess} />}

        {screen === "selection" && currentUser && currentUser.role !== "admin" && !currentUser.isPremium && (
          <PaymentGateScreen
            currentUser={currentUser}
            onSignOut={handleSignOut}
            onMarkPending={handleMarkPaymentPending}
            onRefreshStatus={handleRefreshPremiumStatus}
          />
        )}

        {screen === "selection" && currentUser && (currentUser.role === "admin" || currentUser.isPremium) && (
          <SelectionScreen
            currentUser={currentUser}
            onSignOut={handleSignOut}
            onSelect={handleSelectMinistry}
            isLoading={isLoading}
            error={error}
            onOpenManage={() => setScreen("manage")}
            onOpenManuais={() => setScreen("manuais")}
            userResults={userResults}
            loadingResults={loadingResults}
          />
        )}

        {screen === "manuais" && currentUser && (
          <ManualsScreen currentUser={currentUser} onBack={() => setScreen("selection")} />
        )}

        {screen === "corpo-selection" && currentUser && (
          <CorpoSelectionScreen
            onSelect={handleSelectCorpo}
            onBack={handleBackToMinistrySelection}
            isLoading={isLoading}
            error={error}
          />
        )}

        {screen === "manage" && currentUser && (
          <AdminDashboard adminUser={currentUser} onBack={() => setScreen("selection")} />
        )}

        {screen === "simulator" && selectedMinisterio && (
          <SimulatorScreen
            ministerio={selectedMinisterio}
            corpo={selectedCorpo || undefined}
            perguntas={perguntasFiltro}
            respostas={respostas}
            onSelectOption={handleSelectOption}
            onSubmit={handleSubmitExam}
            onExit={handleExitSimulator}
            onRevealAnswer={handleRevealAnswer}
            revealingId={revealingId}
            revealError={revealError}
          />
        )}

        {screen === "results" && selectedMinisterio && (
          <ResultsScreen
            ministerio={selectedMinisterio}
            corpo={selectedCorpo || undefined}
            perguntas={perguntasFiltro}
            respostas={respostas}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Institutional Footer - no telemóvel dá lugar à barra de navegação
          inferior, por isso só aparece a partir do breakpoint md */}
      <footer className="hidden md:block bg-[var(--color-paper-light)] border-t border-[var(--color-line)] py-6 text-center text-xs text-[var(--color-ink-faint)]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} EstudaBué. Todos os direitos reservados.</p>
          <div className="flex space-x-4">
            <span className="hover:text-[var(--color-navy)] cursor-help transition-colors">Termos de Utilização</span>
            <span>•</span>
            <span className="hover:text-[var(--color-navy)] cursor-help transition-colors">Política de Privacidade</span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar - dá ao painel do candidato uma navegação
          fixa e tátil, como uma app nativa, nos ecrãs "hub" (Início e
          Manuais). Ecrãs de fluxo (prova, resultados, escolha de corpo,
          autenticação) mantêm o seu próprio botão "Voltar" dedicado. */}
      {showBottomNav && currentUser && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-navy)] border-t-2 border-[var(--color-gold)] shadow-[0_-2px_10px_rgba(12,26,46,0.25)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className={`grid ${isAdminUser ? "grid-cols-3" : "grid-cols-2"} h-16`}>
            <button
              id="tab-inicio"
              onClick={() => setScreen("selection")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                screen === "selection" ? "text-[var(--color-gold)]" : "text-white/60 active:text-white/90"
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-wide">Início</span>
            </button>

            <button
              id="tab-manuais"
              onClick={() => setScreen("manuais")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                screen === "manuais" ? "text-[var(--color-gold)]" : "text-white/60 active:text-white/90"
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-wide">Manuais</span>
            </button>

            {isAdminUser && (
              <button
                id="tab-admin"
                onClick={() => setScreen("manage")}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  screen === "manage" ? "text-[var(--color-gold)]" : "text-white/60 active:text-white/90"
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[10px] font-semibold tracking-wide">Painel</span>
              </button>
            )}
          </div>
        </nav>
      )}

      <InstallAppPrompt />
    </div>
  );
}

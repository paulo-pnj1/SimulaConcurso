import React, { useState, useEffect } from "react";
import { Pergunta, ConcursoType, RespostasUsuario, UserProfile, Resultado, SubmitExamResponse } from "./types";
import SelectionScreen from "./components/SelectionScreen";
import SimulatorScreen from "./components/SimulatorScreen";
import ResultsScreen from "./components/ResultsScreen";
import AuthScreen from "./components/AuthScreen";
import AdminDashboard from "./components/AdminDashboard";
import PaymentGateScreen from "./components/PaymentGateScreen";
import { GraduationCap } from "lucide-react";
import { auth, db, getExamQuestionsFn, submitExamFn } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { isAdminEmail } from "./config/admin";

type ScreenType = "auth" | "selection" | "simulator" | "results" | "manage";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("auth");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [selectedMinisterio, setSelectedMinisterio] = useState<ConcursoType | null>(null);
  const [perguntasFiltro, setPerguntasFiltro] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<RespostasUsuario>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSelectMinistry = async (ministerio: ConcursoType) => {
    setIsLoading(true);
    setError(null);

    try {
      // Questions come from the getExamQuestions Cloud Function, which
      // strips `resposta`/`explicacao` server-side and applies the trial
      // limit for non-premium candidates. This is what stops anyone from
      // reading the answer key out of the network tab before answering.
      const response = await getExamQuestionsFn({ ministerio });
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

  const handleRestart = () => {
    setSelectedMinisterio(null);
    setPerguntasFiltro([]);
    setRespostas({});
    setScreen("selection");
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

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col justify-between text-[var(--color-ink)]">
      {/* Top Main Navbar */}
      <header className="bg-[var(--color-navy)] text-white border-b-2 border-[var(--color-gold)] sticky top-0 z-40 shadow-[0_2px_10px_rgba(12,26,46,0.25)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleRestart}>
            <div className="w-9 h-9 border border-white/25 rounded-full flex items-center justify-center text-[var(--color-gold)] group-hover:border-[var(--color-gold)] transition-colors">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-display font-semibold text-base md:text-lg text-white tracking-tight block leading-none">
                Simulador de Exames Angola
              </span>
              <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.2em] block mt-1">
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
      <main className="flex-grow">
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
            userResults={userResults}
            loadingResults={loadingResults}
          />
        )}

        {screen === "manage" && currentUser && (
          <AdminDashboard adminUser={currentUser} onBack={() => setScreen("selection")} />
        )}

        {screen === "simulator" && selectedMinisterio && (
          <SimulatorScreen
            ministerio={selectedMinisterio}
            perguntas={perguntasFiltro}
            respostas={respostas}
            onSelectOption={handleSelectOption}
            onSubmit={handleSubmitExam}
          />
        )}

        {screen === "results" && selectedMinisterio && (
          <ResultsScreen
            ministerio={selectedMinisterio}
            perguntas={perguntasFiltro}
            respostas={respostas}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-[var(--color-paper-light)] border-t border-[var(--color-line)] py-6 text-center text-xs text-[var(--color-ink-faint)]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} Simulador de Exames Angola. Todos os direitos reservados.</p>
          <div className="flex space-x-4">
            <span className="hover:text-[var(--color-navy)] cursor-help transition-colors">Termos de Utilização</span>
            <span>•</span>
            <span className="hover:text-[var(--color-navy)] cursor-help transition-colors">Política de Privacidade</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

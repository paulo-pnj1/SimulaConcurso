import React, { useState, useEffect } from "react";
import { Pergunta, ConcursoType, RespostasUsuario, UserProfile, Resultado, SubmitExamResponse } from "./types";
import SelectionScreen from "./components/SelectionScreen";
import SimulatorScreen from "./components/SimulatorScreen";
import ResultsScreen from "./components/ResultsScreen";
import AuthScreen from "./components/AuthScreen";
import AdminDashboard from "./components/AdminDashboard";
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
  const [isTrial, setIsTrial] = useState<boolean>(false);
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

          const profile: UserProfile = {
            uid: user.uid,
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            role: role as "admin" | "candidate",
            isPremium: false,
          };

          if (userSnap.exists()) {
            const data = userSnap.data();
            profile.name = data.name || profile.name;
            profile.role = data.role || profile.role;
            profile.isPremium = data.isPremium === true;
          } else {
            await setDoc(userRef, {
              ...profile,
              createdAt: new Date().toISOString(),
            });
          }

          setCurrentUser(profile);
          setScreen("selection");
        } catch (e) {
          console.error("Erro ao carregar perfil do utilizador:", e);
          setCurrentUser({
            uid: user.uid,
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            role: isAdminEmail(user.email) ? "admin" : "candidate",
            isPremium: false,
          });
          setScreen("selection");
        } finally {
          setIsLoading(false);
        }
      } else {
        // Only reset if we are not signed in as a local Demo user
        setCurrentUser((prev) => {
          if (prev?.uid.startsWith("demo-")) {
            return prev; // keep demo user session active
          }
          setScreen("auth");
          return null;
        });
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
      // fallback mock results for Demo user
      if (uid.startsWith("demo-")) {
        setUserResults([
          {
            id: "demo-res-1",
            candidateUid: "demo-candidate-123",
            candidateName: "Candidato de Teste",
            candidateEmail: "candidato@concurso.ao",
            ministerio: "MININT" as ConcursoType,
            score: 70,
            respostasCorretas: 14,
            totalPerguntas: 20,
            tempoGasto: 1045,
            createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          }
        ]);
      }
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
      const { perguntas, isTrial: trialNow } = response.data as {
        perguntas: Pergunta[];
        isTrial: boolean;
      };

      setIsTrial(trialNow);
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
    if (currentUser?.uid.startsWith("demo-")) {
      // Clear demo state locally
      setCurrentUser(null);
      setScreen("auth");
    } else {
      try {
        await signOut(auth);
        setCurrentUser(null);
        setScreen("auth");
      } catch (e) {
        console.error("Erro no logout:", e);
      }
    }
  };

  const handleAuthSuccess = (userProfile: UserProfile) => {
    setCurrentUser(userProfile);
    setScreen("selection");
  };

  // Permite ao candidato verificar se o Admin já ativou o seu acesso Premium
  const handleRefreshPremiumStatus = async () => {
    if (!currentUser || currentUser.uid.startsWith("demo-")) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentUser((prev) => (prev ? { ...prev, isPremium: data.isPremium === true } : prev));
      }
    } catch (e) {
      console.error("Erro ao verificar estado Premium:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col justify-between text-[#1C1E21]">
      {/* Top Main Navbar */}
      <header className="bg-[#1A365D] text-white border-b-4 border-[#C02424] sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={handleRestart}>
            <div className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white shadow-md transition-colors">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm md:text-base text-white tracking-tight block leading-none">
                SIMULADOR DE EXAMES ANGOLA
              </span>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mt-0.5">
                Função Pública de Angola
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Angola Colors Ribbon representation */}
            <div className="flex space-x-1">
              <span className="w-2.5 h-4 bg-red-600 rounded-sm shadow-xs" />
              <span className="w-2.5 h-4 bg-yellow-500 rounded-sm shadow-xs" />
              <span className="w-2.5 h-4 bg-black rounded-sm shadow-xs" />
            </div>
            <span className="text-xs font-bold text-slate-200 hidden sm:inline-block">MININT / MINSA</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        {screen === "auth" && <AuthScreen onAuthSuccess={handleAuthSuccess} />}

        {screen === "selection" && (
          <SelectionScreen
            currentUser={currentUser}
            onSignOut={handleSignOut}
            onSelect={handleSelectMinistry}
            isLoading={isLoading}
            error={error}
            onOpenManage={() => setScreen("manage")}
            userResults={userResults}
            loadingResults={loadingResults}
            onRefreshPremiumStatus={handleRefreshPremiumStatus}
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
            isTrial={isTrial}
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
      <footer className="bg-white border-t border-gray-150 py-6 text-center text-xs text-gray-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} Simulador de Exames Angola. Todos os direitos reservados.</p>
          <div className="flex space-x-4">
            <span className="hover:text-gray-600 cursor-help transition-colors">Termos de Utilização</span>
            <span>•</span>
            <span className="hover:text-gray-600 cursor-help transition-colors">Política de Privacidade</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

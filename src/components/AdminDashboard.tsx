import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Users,
  Database,
  Search,
  TrendingUp,
  Clock,
  Award,
  Filter,
  BarChart3,
  Calendar,
  Lock,
  Sparkles,
  ShieldCheck,
  ShieldOff,
  Wallet,
  Upload,
  FileText,
  Download
} from "lucide-react";
import { Pergunta, ConcursoType, CorpoMinint, CORPOS_MININT, PREMIUM_CONFIG, Manual } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { motion } from "motion/react";

interface AdminDashboardProps {
  adminUser: { uid: string; name: string; email: string };
  onBack: () => void;
}

interface CandidateResult {
  id: string;
  candidateUid: string;
  candidateName: string;
  candidateEmail: string;
  ministerio: ConcursoType;
  score: number;
  respostasCorretas: number;
  totalPerguntas: number;
  tempoGasto: number;
  createdAt: string;
}

interface CandidateUser {
  uid: string;
  name: string;
  email: string;
  telefone?: string;
  role: "admin" | "candidate";
  isPremium?: boolean;
  premiumActivatedAt?: string;
  paymentStatus?: "none" | "pending";
  createdAt?: string;
}

export default function AdminDashboard({ adminUser, onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"candidates" | "questions" | "premium" | "manuais">("candidates");

  // State for Study Manuals (link-based, no Firebase Storage / no paid plan needed)
  const [manuais, setManuais] = useState<Manual[]>([]);
  const [loadingManuais, setLoadingManuais] = useState(false);
  const [manualTitulo, setManualTitulo] = useState("");
  const [manualDescricao, setManualDescricao] = useState("");
  const [manualMinisterio, setManualMinisterio] = useState<ConcursoType | "TODOS">("TODOS");
  const [manualCorpo, setManualCorpo] = useState<CorpoMinint | "">("");
  const [manualFileUrl, setManualFileUrl] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [deletingManualId, setDeletingManualId] = useState<string | null>(null);

  // State for Premium Management
  const [users, setUsers] = useState<CandidateUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [premiumFilter, setPremiumFilter] = useState<"ALL" | "PREMIUM" | "PENDING" | "FREE">("ALL");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // State for Candidate Results
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [ministryFilter, setMinistryFilter] = useState<string>("ALL");

  // State for Custom Questions
  const [customQuestions, setCustomQuestions] = useState<Pergunta[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Form State for Adding Questions
  const [ministerio, setMinisterio] = useState<ConcursoType>("MININT");
  const [corpo, setCorpo] = useState<CorpoMinint | "">("");
  const [categoria, setCategoria] = useState<string>("");
  const [enunciado, setEnunciado] = useState<string>("");
  const [opcoes, setOpcoes] = useState<string[]>(["", "", "", ""]);
  const [resposta, setResposta] = useState<number>(0);
  const [explicacao, setExplicacao] = useState<string>("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load results from Firestore on mount
  useEffect(() => {
    fetchResults();
    fetchCustomQuestions();
    fetchUsers();
    fetchManuais();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const fetched: CandidateUser[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push(docSnap.data() as CandidateUser);
      });
      fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUsers(fetched);
    } catch (err: any) {
      console.error("Erro ao carregar lista de candidatos:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Concede ou revoga o acesso Premium de um candidato depois de confirmar o
  // comprovativo de pagamento (Multicaixa Express / Transferência) recebido no WhatsApp.
  const handleTogglePremium = async (candidate: CandidateUser) => {
    const grantingAccess = !candidate.isPremium;
    const confirmMsg = grantingAccess
      ? `Confirma que recebeu e validou o comprovativo de pagamento de ${candidate.name} (${candidate.email})? Isto vai ativar o acesso Premium vitalício.`
      : `Tem a certeza que quer revogar o acesso Premium de ${candidate.name} (${candidate.email})?`;

    if (!window.confirm(confirmMsg)) return;

    setUpdatingUid(candidate.uid);
    try {
      const userRef = doc(db, "users", candidate.uid);
      await setDoc(
        userRef,
        {
          isPremium: grantingAccess,
          premiumActivatedAt: grantingAccess ? new Date().toISOString() : null,
          paymentStatus: "none",
        },
        { merge: true }
      );

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === candidate.uid
            ? {
                ...u,
                isPremium: grantingAccess,
                premiumActivatedAt: grantingAccess ? new Date().toISOString() : undefined,
                paymentStatus: "none",
              }
            : u
        )
      );

      setFeedback({
        type: "success",
        message: grantingAccess
          ? `Acesso Premium ativado para ${candidate.name}.`
          : `Acesso Premium revogado para ${candidate.name}.`,
      });
    } catch (err: any) {
      console.error("Erro ao atualizar estado Premium:", err);
      setFeedback({
        type: "error",
        message: `Não foi possível atualizar o Premium. Verifique as regras do Firestore. (${err.message})`,
      });
    } finally {
      setUpdatingUid(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const fetchResults = async () => {
    setLoadingResults(true);
    try {
      const resultsRef = collection(db, "resultados");
      // Fallback query if no index is configured yet
      const q = query(resultsRef);
      const snapshot = await getDocs(q);
      const fetched: CandidateResult[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as CandidateResult);
      });
      // Sort client side to bypass potential composite index requirements
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setResults(fetched);
    } catch (err: any) {
      console.error("Erro ao carregar resultados dos candidatos:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  const fetchCustomQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const questionsRef = collection(db, "perguntas");
      const snapshot = await getDocs(questionsRef);
      const fetched: Pergunta[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push(docSnap.data() as Pergunta);
      });
      setCustomQuestions(fetched);
    } catch (err: any) {
      console.error("Erro ao carregar perguntas customizadas:", err);
      // Fallback to local storage if user is offline or Firebase is configuring
      const stored = localStorage.getItem("custom_perguntas");
      if (stored) {
        try {
          setCustomQuestions(JSON.parse(stored));
        } catch (e) {
          console.error("Erro ao ler localStorage:", e);
        }
      }
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchManuais = async () => {
    setLoadingManuais(true);
    try {
      const manuaisRef = collection(db, "manuais");
      const snapshot = await getDocs(manuaisRef);
      const fetched: Manual[] = [];
      snapshot.forEach((docSnap) => fetched.push(docSnap.data() as Manual));
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setManuais(fetched);
    } catch (err: any) {
      console.error("Erro ao carregar manuais:", err);
    } finally {
      setLoadingManuais(false);
    }
  };

  // Validação simples: aceita um URL http(s) qualquer (Google Drive,
  // Dropbox, OneDrive, etc.). Não valida se o link é mesmo um PDF nem se é
  // "de download direto" — isso é responsabilidade de quem cola o link.
  const isValidUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualTitulo.trim()) {
      setFeedback({ type: "error", message: "Indique um título para o manual." });
      return;
    }
    if (!manualFileUrl.trim() || !isValidUrl(manualFileUrl)) {
      setFeedback({
        type: "error",
        message: "Cole um link válido (começado por http:// ou https://) para o PDF.",
      });
      return;
    }

    const manualId = "man-" + Date.now();

    const newManual: Manual = {
      id: manualId,
      titulo: manualTitulo.trim(),
      descricao: manualDescricao.trim(),
      ministerio: manualMinisterio,
      ...(manualMinisterio === "MININT" && manualCorpo ? { corpo: manualCorpo } : {}),
      fileUrl: manualFileUrl.trim(),
      createdBy: adminUser.uid,
      createdAt: new Date().toISOString(),
    };

    setSavingManual(true);
    try {
      await setDoc(doc(db, "manuais", manualId), newManual);

      setManuais((prev) => [newManual, ...prev]);
      setManualTitulo("");
      setManualDescricao("");
      setManualMinisterio("TODOS");
      setManualCorpo("");
      setManualFileUrl("");

      setFeedback({ type: "success", message: "Manual publicado com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao guardar o manual:", err);
      setFeedback({
        type: "error",
        message: `Não foi possível publicar o manual. Verifique as regras do Firestore. (${err.message})`,
      });
    } finally {
      setSavingManual(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDeleteManual = async (manual: Manual) => {
    if (!window.confirm(`Eliminar o manual "${manual.titulo}"? Esta ação não pode ser desfeita.`)) return;

    setDeletingManualId(manual.id);
    try {
      await deleteDoc(doc(db, "manuais", manual.id));
      setManuais((prev) => prev.filter((m) => m.id !== manual.id));
      setFeedback({ type: "success", message: "Manual eliminado com sucesso." });
    } catch (err: any) {
      console.error("Erro ao eliminar manual:", err);
      setFeedback({ type: "error", message: `Não foi possível eliminar o manual. (${err.message})` });
    } finally {
      setDeletingManualId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleOpcaoChange = (index: number, value: string) => {
    const updated = [...opcoes];
    updated[index] = value;
    setOpcoes(updated);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!categoria.trim()) {
      setFeedback({ type: "error", message: "Por favor, indique a categoria (ex: Direito Penal)." });
      return;
    }
    if (!enunciado.trim()) {
      setFeedback({ type: "error", message: "O enunciado da pergunta não pode estar vazio." });
      return;
    }
    if (opcoes.some((opt) => !opt.trim())) {
      setFeedback({ type: "error", message: "Todas as 4 opções de resposta devem ser preenchidas." });
      return;
    }
    if (!explicacao.trim()) {
      setFeedback({ type: "error", message: "Adicione uma explicação pedagógica para o gabarito comentado." });
      return;
    }

    const questionId = "q-" + Date.now();

    // Create new question object matching firestore-blueprint
    const newQuestion: Pergunta & { createdBy: string; createdAt: string } = {
      id: questionId as any, // Cast for matching string ID
      ministerio,
      ...(ministerio === "MININT" && corpo ? { corpo } : {}),
      categoria: categoria.trim(),
      enunciado: enunciado.trim(),
      opcoes: opcoes.map((opt) => opt.trim()),
      resposta,
      explicacao: explicacao.trim(),
      createdBy: adminUser.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      // Save directly to Firestore
      const questionDocRef = doc(db, "perguntas", questionId);
      await setDoc(questionDocRef, newQuestion);

      // Add to local state
      const updatedList = [...customQuestions, newQuestion as any];
      setCustomQuestions(updatedList);
      // Sync local storage as redundancy/offline fallback
      localStorage.setItem("custom_perguntas", JSON.stringify(updatedList));

      // Reset Form
      setCorpo("");
      setCategoria("");
      setEnunciado("");
      setOpcoes(["", "", "", ""]);
      setResposta(0);
      setExplicacao("");

      setFeedback({
        type: "success",
        message: `Pergunta de ${ministerio} adicionada com sucesso ao banco de dados Firestore!`,
      });
    } catch (err: any) {
      console.error("Erro ao adicionar pergunta ao Firestore:", err);
      
      // Fallback operation locally if permissions block
      const updatedList = [...customQuestions, newQuestion as any];
      setCustomQuestions(updatedList);
      localStorage.setItem("custom_perguntas", JSON.stringify(updatedList));

      setFeedback({
        type: "success",
        message: `Adicionada localmente! (Firestore offline ou sem permissão: ${err.message})`,
      });
    }

    // Auto clear feedback
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleDeleteQuestion = async (id: any) => {
    if (window.confirm("Deseja mesmo eliminar esta pergunta do banco de dados?")) {
      try {
        const idStr = String(id);
        const questionDocRef = doc(db, "perguntas", idStr);
        await deleteDoc(questionDocRef);

        const updatedList = customQuestions.filter((q) => q.id !== id);
        setCustomQuestions(updatedList);
        localStorage.setItem("custom_perguntas", JSON.stringify(updatedList));

        setFeedback({
          type: "success",
          message: "Pergunta eliminada com sucesso.",
        });
      } catch (err: any) {
        console.error("Erro ao eliminar pergunta:", err);
        const updatedList = customQuestions.filter((q) => q.id !== id);
        setCustomQuestions(updatedList);
        localStorage.setItem("custom_perguntas", JSON.stringify(updatedList));
        setFeedback({
          type: "error",
          message: `Erro ao eliminar do Firestore. Removida localmente. (${err.message})`,
        });
      }
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Stats Aggregations
  const totalExams = results.length;
  const passedExams = results.filter((r) => r.score >= 50).length;
  const passRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;
  const averageScore =
    totalExams > 0
      ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalExams)
      : 0;

  const filteredResults = results.filter((res) => {
    const matchesSearch =
      res.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.candidateEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMinistry = ministryFilter === "ALL" || res.ministerio === ministryFilter;
    return matchesSearch && matchesMinistry;
  });

  // Premium stats & filtering
  const candidateUsers = users.filter((u) => u.role !== "admin");
  const premiumCount = candidateUsers.filter((u) => u.isPremium).length;
  const pendingCount = candidateUsers.filter((u) => !u.isPremium && u.paymentStatus === "pending").length;
  const priceNumber = parseInt(PREMIUM_CONFIG.priceLabel.replace(/[^\d]/g, ""), 10) || 0;
  const estimatedRevenue = premiumCount * priceNumber;

  const filteredUsers = candidateUsers.filter((u) => {
    const matchesSearch =
      (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.telefone || "").includes(userSearch);
    const matchesFilter =
      premiumFilter === "ALL" ||
      (premiumFilter === "PREMIUM" && u.isPremium) ||
      (premiumFilter === "PENDING" && !u.isPremium && u.paymentStatus === "pending") ||
      (premiumFilter === "FREE" && !u.isPremium && u.paymentStatus !== "pending");
    return matchesSearch && matchesFilter;
  });

  const formatTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back button & Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-stone-600 hover:text-[#12233F] font-bold text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Plataforma</span>
        </button>

        <div className="bg-[#12233F]/10 text-[#12233F] text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Portal Administrador: {adminUser.name}</span>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-sans font-extrabold tracking-tight text-[#12233F]">
          Painel de Controlo Concurso Público
        </h1>
        <p className="text-sm text-[#7A7060] mt-1">
          Monitorize as submissões de exames de candidatos em tempo real e faça a gestão do banco de perguntas do MININT e MINSA.
        </p>
      </div>

      {/* Stats Cards (Rendered when Results Tab is Active) */}
      {activeTab === "candidates" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 bg-[#EAF0F7] text-[#12233F] rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Total de Submissões
              </span>
              <span className="text-2xl font-black text-stone-800">{totalExams}</span>
            </div>
          </div>

          <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Média de Pontuação
              </span>
              <span className="text-2xl font-black text-stone-800">{averageScore}%</span>
            </div>
          </div>

          <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Taxa de Aprovação
              </span>
              <span className="text-2xl font-black text-stone-800">{passRate}%</span>
            </div>
          </div>

          <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Perguntas Customizadas
              </span>
              <span className="text-2xl font-black text-stone-800">
                {customQuestions.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E3D9C4] mb-8 gap-1.5">
        <button
          onClick={() => setActiveTab("candidates")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "candidates"
              ? "border-[#12233F] text-[#12233F]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Monitor de Candidatos ({results.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "questions"
              ? "border-[#12233F] text-[#12233F]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Gestão de Perguntas ({customQuestions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("premium")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "premium"
              ? "border-[#12233F] text-[#12233F]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Pagamentos / Premium ({premiumCount})</span>
        </button>
        <button
          onClick={() => setActiveTab("manuais")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "manuais"
              ? "border-[#12233F] text-[#12233F]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Manuais de Estudo ({manuais.length})</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === "candidates" && (
        <div className="bg-white border border-[#E3D9C4] rounded-2xl shadow-xs overflow-hidden">
          {/* Filters Area */}
          <div className="p-5 border-b border-[#E3D9C4] bg-stone-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Search */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome ou email do candidato..."
                className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <Filter className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <button
                onClick={() => setMinistryFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  ministryFilter === "ALL"
                    ? "bg-[#12233F] text-white"
                    : "bg-white border border-[#D8CBB0] text-stone-600 hover:bg-stone-100"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setMinistryFilter("MININT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  ministryFilter === "MININT"
                    ? "bg-[#12233F] text-white"
                    : "bg-white border border-[#D8CBB0] text-stone-600 hover:bg-stone-100"
                }`}
              >
                MININT
              </button>
              <button
                onClick={() => setMinistryFilter("MINSA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  ministryFilter === "MINSA"
                    ? "bg-[#12233F] text-white"
                    : "bg-white border border-[#D8CBB0] text-stone-600 hover:bg-stone-100"
                }`}
              >
                MINSA
              </button>
            </div>
          </div>

          {/* Results Table */}
          {loadingResults ? (
            <div className="py-16 text-center text-stone-500 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#12233F] mx-auto mb-4"></div>
              <span>A carregar classificações dos candidatos...</span>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-700">Nenhum Exame Encontrado</h3>
              <p className="text-xs text-stone-400 mt-1">
                Não existem tentativas gravadas que correspondam aos filtros de pesquisa.
              </p>
            </div>
          ) : (
            <div>
              {/* Mobile Card List (visible only on small screens) */}
              <div className="md:hidden divide-y divide-stone-100">
                {filteredResults.map((res) => {
                  const isPassed = res.score >= 50;
                  return (
                    <div key={res.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-stone-800 text-sm block">
                            {res.candidateName}
                          </span>
                          <span className="text-[10px] text-stone-400 block mt-0.5">
                            {res.candidateEmail}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                            res.ministerio === "MININT"
                              ? "bg-[#EAF0F7] text-[#12233F] border border-[#D9E4F0]"
                              : "bg-red-50 text-[#A62639] border border-red-100"
                          }`}
                        >
                          {res.ministerio}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 bg-stone-50 p-2.5 rounded-lg text-center text-[10px]">
                        <div>
                          <span className="text-stone-400 block uppercase font-semibold">Nota</span>
                          <span className="font-black text-stone-800 text-xs">{res.score}%</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block uppercase font-semibold">Respostas</span>
                          <span className="font-bold text-stone-700 text-xs">
                            {res.respostasCorretas}/{res.totalPerguntas}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block uppercase font-semibold">Tempo</span>
                          <span className="font-bold text-stone-700 text-xs flex items-center justify-center gap-0.5">
                            <Clock className="w-3 h-3 text-stone-400" />
                            {formatTempo(res.tempoGasto)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          {new Date(res.createdAt).toLocaleDateString("pt-AO", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            isPassed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              isPassed ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {isPassed ? "Aprovado" : "Reprovado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (hidden on mobile/small screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-[#E3D9C4] text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-5">Candidato</th>
                      <th className="py-3 px-5">Concurso</th>
                      <th className="py-3 px-5 text-center">Pontuação</th>
                      <th className="py-3 px-5 text-center">Respostas</th>
                      <th className="py-3 px-5 text-center">Tempo Gasto</th>
                      <th className="py-3 px-5">Data da Submissão</th>
                      <th className="py-3 px-5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                    {filteredResults.map((res) => {
                      const isPassed = res.score >= 50;
                      return (
                        <tr key={res.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-5">
                            <span className="font-bold text-stone-800 block text-sm">
                              {res.candidateName}
                            </span>
                            <span className="text-[10px] text-stone-400 block mt-0.5">
                              {res.candidateEmail}
                            </span>
                          </td>
                          <td className="py-4 px-5 font-semibold">
                            <span
                              className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                res.ministerio === "MININT"
                                  ? "bg-[#EAF0F7] text-[#12233F] border border-[#D9E4F0]"
                                  : "bg-red-50 text-[#A62639] border border-red-100"
                              }`}
                            >
                              {res.ministerio}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-center font-black text-sm text-stone-800">
                            {res.score}%
                          </td>
                          <td className="py-4 px-5 text-center text-stone-500 font-semibold">
                            {res.respostasCorretas} / {res.totalPerguntas}
                          </td>
                          <td className="py-4 px-5 text-center text-stone-500 font-medium">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>{formatTempo(res.tempoGasto)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-stone-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span>
                                {new Date(res.createdAt).toLocaleDateString("pt-AO", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isPassed
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : "bg-red-50 text-red-700 border border-red-100"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPassed ? "bg-emerald-500" : "bg-red-500"
                                }`}
                              />
                              {isPassed ? "Aprovado" : "Reprovado"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "questions" && (
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form to add question */}
          <div className="lg:col-span-3 bg-white border border-[#E3D9C4] rounded-2xl p-6 shadow-xs h-fit">
            <h2 className="text-lg font-bold text-[#201C16] mb-5 border-b border-[#E3D9C4] pb-3 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#12233F]" />
              Formulário de Nova Questão
            </h2>

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-5 p-4 rounded-xl border flex items-start space-x-3 text-sm ${
                  feedback.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <span className="font-medium">{feedback.message}</span>
              </motion.div>
            )}

            <form onSubmit={handleAddQuestion} className="space-y-5">
              {/* Row 1: Ministério & Categoria */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                    Ministério / Concurso *
                  </label>
                  <select
                    value={ministerio}
                    onChange={(e) => setMinisterio(e.target.value as ConcursoType)}
                    className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  >
                    <option value="MININT">MININT (Interior)</option>
                    <option value="MINSA">MINSA (Saúde)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                    Categoria da Pergunta *
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Constituição (CRA), Deontologia"
                    className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  />
                </div>
              </div>

              {/* Corpo (só MININT) */}
              {ministerio === "MININT" && (
                <div>
                  <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                    Corpo / Serviço (opcional)
                  </label>
                  <select
                    value={corpo}
                    onChange={(e) => setCorpo(e.target.value as CorpoMinint | "")}
                    className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  >
                    <option value="">Geral (entra no exame de qualquer corpo)</option>
                    {CORPOS_MININT.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Deixe em "Geral" para uma pergunta comum (Constituição, símbolos nacionais, etc.).
                    Escolha um corpo específico para uma pergunta que só deve aparecer nesse exame.
                  </p>
                </div>
              )}

              {/* Enunciado */}
              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Enunciado da Pergunta *
                </label>
                <textarea
                  rows={3}
                  value={enunciado}
                  onChange={(e) => setEnunciado(e.target.value)}
                  placeholder="Introduza o enunciado completo ou caso clínico da pergunta..."
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg p-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>

              {/* Opções de Resposta */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider">
                  Opções de Resposta *
                </label>

                {["A", "B", "C", "D"].map((letra, index) => (
                  <div key={letra} className="flex items-center space-x-2">
                    <span className="w-8 h-8 flex-shrink-0 bg-stone-100 text-stone-600 font-bold text-xs rounded-lg flex items-center justify-center border border-stone-200">
                      {letra}
                    </span>
                    <input
                      type="text"
                      value={opcoes[index]}
                      onChange={(e) => handleOpcaoChange(index, e.target.value)}
                      placeholder={`Texto para a opção ${letra}`}
                      className="flex-grow bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                    />
                  </div>
                ))}
              </div>

              {/* Opção Correta */}
              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Gabarito (Opção Correta) *
                </label>
                <select
                  value={resposta}
                  onChange={(e) => setResposta(parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                >
                  <option value={0}>Opção A é a correta</option>
                  <option value={1}>Opção B é a correta</option>
                  <option value={2}>Opção C é a correta</option>
                  <option value={3}>Opção D é a correta</option>
                </select>
              </div>

              {/* Explicação */}
              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Explicação / Gabarito Comentado *
                </label>
                <textarea
                  rows={3}
                  value={explicacao}
                  onChange={(e) => setExplicacao(e.target.value)}
                  placeholder="Forneça a fundamentação pedagógica ou jurídica..."
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg p-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Gravar Pergunta no Firestore</span>
              </button>
            </form>
          </div>

          {/* Right Side: List of custom added questions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#E3D9C4] rounded-2xl p-6 shadow-xs h-full flex flex-col">
              <h2 className="text-lg font-bold text-[#201C16] border-b border-[#E3D9C4] pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-stone-500" />
                  Perguntas Criadas
                </span>
                <span className="bg-[#12233F] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {customQuestions.length}
                </span>
              </h2>

              {loadingQuestions ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-stone-500 mx-auto mb-2"></div>
                  <span>A carregar banco customizado...</span>
                </div>
              ) : customQuestions.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 mb-3">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#201C16] mb-1">Nenhuma Pergunta Adicionada</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Perguntas que adicionar ao Firestore aparecerão listadas aqui para eliminação rápida.
                  </p>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto max-h-[550px] space-y-3.5 pr-1 mt-4">
                  {customQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="border border-[#E3D9C4] rounded-lg p-3.5 bg-stone-50 relative group transition-colors hover:border-[#12233F]"
                    >
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Eliminar Pergunta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center space-x-2 mb-2 pr-6">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                            q.ministerio === "MININT"
                              ? "bg-[#D9E4F0] text-[#12233F]"
                              : "bg-red-100 text-[#A62639]"
                          }`}
                        >
                          {q.ministerio}
                        </span>
                        {q.corpo && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-stone-200 text-stone-600 max-w-[130px] truncate">
                            {q.corpo}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-stone-500 max-w-[120px] truncate">
                          {q.categoria}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-stone-800 line-clamp-2 mb-2 pr-4 leading-normal">
                        {q.enunciado}
                      </h4>

                      <div className="text-[11px] text-emerald-700 font-medium flex items-center space-x-1">
                        <span className="bg-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-800">
                          R: {["A", "B", "C", "D"][q.resposta]}
                        </span>
                        <span className="truncate max-w-[140px] text-stone-500">
                          {q.opcoes[q.resposta]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "premium" && (
        <div>
          {/* Revenue Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Candidatos Premium
                </span>
                <span className="text-2xl font-black text-stone-800">{premiumCount}</span>
              </div>
            </div>
            <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
              <div className="w-12 h-12 bg-[#EAF0F7] text-[#12233F] rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Receita Estimada
                </span>
                <span className="text-2xl font-black text-stone-800">
                  {estimatedRevenue.toLocaleString("pt-AO")} Kz
                </span>
              </div>
            </div>
            <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  A Aguardar Verificação
                </span>
                <span className="text-2xl font-black text-stone-800">{pendingCount}</span>
              </div>
            </div>
            <div className="bg-white border border-[#E3D9C4] p-5 rounded-2xl flex items-center gap-4 shadow-xs">
              <div className="w-12 h-12 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Total de Candidatos
                </span>
                <span className="text-2xl font-black text-stone-800">{candidateUsers.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs leading-relaxed mb-6">
            <strong>Como aprovar um pagamento:</strong> quando um candidato lhe enviar o comprovativo pelo
            WhatsApp, confirme se o número de telemóvel que aparece como ordenante da transferência Multicaixa
            Express corresponde ao número registado do candidato (mostrado abaixo, junto ao nome). Se coincidir,
            procure o candidato pelo nome, email ou número e clique em "Ativar Premium".
          </div>

          <div className="bg-white border border-[#E3D9C4] rounded-2xl shadow-xs overflow-hidden">
            {/* Filters */}
            <div className="p-5 border-b border-[#E3D9C4] bg-stone-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-stone-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Pesquisar por nome, email ou telemóvel do candidato..."
                  className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                <Filter className="w-4 h-4 text-stone-400 flex-shrink-0" />
                {(["ALL", "PENDING", "PREMIUM", "FREE"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPremiumFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      premiumFilter === f
                        ? "bg-[#12233F] text-white"
                        : "bg-white border border-[#D8CBB0] text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {f === "ALL" ? "Todos" : f === "PENDING" ? "Pendentes" : f === "PREMIUM" ? "Premium" : "Gratuito"}
                  </button>
                ))}
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-16 text-center text-stone-500 text-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#12233F] mx-auto mb-4"></div>
                <span>A carregar candidatos...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-stone-700">Nenhum Candidato Encontrado</h3>
                <p className="text-xs text-stone-400 mt-1">
                  Ajuste a pesquisa ou o filtro acima.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          u.isPremium ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"
                        }`}
                      >
                        {u.isPremium ? <ShieldCheck className="w-4.5 h-4.5" /> : <ShieldOff className="w-4.5 h-4.5" />}
                      </div>
                      <div>
                        <span className="font-bold text-stone-800 text-sm block">{u.name}</span>
                        <span className="text-[10px] text-stone-400 block mt-0.5">{u.email}</span>
                        <span className="text-[10px] text-stone-500 font-semibold block mt-0.5">
                          📱 {u.telefone || "sem número registado"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          u.isPremium
                            ? "bg-emerald-100 text-emerald-700"
                            : u.paymentStatus === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {u.isPremium ? "Premium ativo" : u.paymentStatus === "pending" ? "Pendente de verificação" : "Acesso bloqueado"}
                      </span>
                      <button
                        onClick={() => handleTogglePremium(u)}
                        disabled={updatingUid === u.uid}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                          u.isPremium
                            ? "border border-red-200 text-red-600 hover:bg-red-50"
                            : "bg-[#12233F] hover:bg-[#0C1A2E] text-white"
                        }`}
                      >
                        {updatingUid === u.uid
                          ? "A atualizar..."
                          : u.isPremium
                          ? "Revogar Premium"
                          : "Ativar Premium"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manuais" && (
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Formulário de upload */}
          <div className="lg:col-span-2 bg-white border border-[#E3D9C4] rounded-2xl p-6 shadow-xs h-fit">
            <h2 className="text-lg font-bold text-[#201C16] mb-5 border-b border-[#E3D9C4] pb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#12233F]" />
              Publicar Novo Manual
            </h2>

            <div className="mb-5 p-3.5 rounded-xl bg-[#EAF0F7] border border-[#D9E4F0] text-[11px] text-[#12233F] leading-relaxed">
              <strong>Como obter o link:</strong> carregue o PDF para o seu Google Drive → botão direito no
              ficheiro → <strong>Partilhar</strong> → mude para <strong>"Qualquer pessoa com o link"</strong> →
              copie o link e cole abaixo. Funciona também com Dropbox, OneDrive ou qualquer link direto de PDF.
            </div>

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-5 p-4 rounded-xl border flex items-start space-x-3 text-sm ${
                  feedback.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <span className="font-medium">{feedback.message}</span>
              </motion.div>
            )}

            <form onSubmit={handleSaveManual} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Título do Manual *
                </label>
                <input
                  type="text"
                  value={manualTitulo}
                  onChange={(e) => setManualTitulo(e.target.value)}
                  placeholder="Ex: Manual de Preparação — Polícia Nacional"
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Descrição (opcional)
                </label>
                <textarea
                  rows={2}
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  placeholder="Breve descrição do conteúdo do manual..."
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg p-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                    Concurso *
                  </label>
                  <select
                    value={manualMinisterio}
                    onChange={(e) => setManualMinisterio(e.target.value as ConcursoType | "TODOS")}
                    className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  >
                    <option value="TODOS">Geral (todos os concursos)</option>
                    <option value="MININT">MININT (Interior)</option>
                    <option value="MINSA">MINSA (Saúde)</option>
                  </select>
                </div>

                {manualMinisterio === "MININT" && (
                  <div>
                    <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                      Corpo (opcional)
                    </label>
                    <select
                      value={manualCorpo}
                      onChange={(e) => setManualCorpo(e.target.value as CorpoMinint | "")}
                      className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                    >
                      <option value="">Geral (qualquer corpo)</option>
                      {CORPOS_MININT.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] uppercase tracking-wider mb-1.5">
                  Link do PDF *
                </label>
                <input
                  type="url"
                  value={manualFileUrl}
                  onChange={(e) => setManualFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-stone-50 border border-[#D8CBB0] rounded-lg px-3 py-2 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                />
              </div>

              <button
                type="submit"
                disabled={savingManual}
                className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white text-sm font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>{savingManual ? "A publicar..." : "Publicar Manual"}</span>
              </button>
            </form>
          </div>

          {/* Lista de manuais existentes */}
          <div className="lg:col-span-3 bg-white border border-[#E3D9C4] rounded-2xl p-6 shadow-xs flex flex-col">
            <h2 className="text-lg font-bold text-[#201C16] mb-5 border-b border-[#E3D9C4] pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#12233F]" />
              Manuais Publicados ({manuais.length})
            </h2>

            {loadingManuais ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-stone-500 mx-auto mb-2"></div>
                <span>A carregar manuais...</span>
              </div>
            ) : manuais.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center flex-grow justify-center">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-stone-400" />
                </div>
                <h3 className="text-sm font-semibold text-[#201C16] mb-1">Nenhum Manual Publicado</h3>
                <p className="text-xs text-stone-400 leading-relaxed max-w-xs">
                  Os manuais que carregar aqui ficam disponíveis para download pelos candidatos Premium.
                </p>
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto max-h-[600px] space-y-3 pr-1">
                {manuais.map((manual) => (
                  <div
                    key={manual.id}
                    className="border border-[#E3D9C4] rounded-lg p-4 bg-stone-50 relative group transition-colors hover:border-[#12233F]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                              manual.ministerio === "MININT"
                                ? "bg-[#D9E4F0] text-[#12233F]"
                                : manual.ministerio === "MINSA"
                                ? "bg-red-100 text-[#A62639]"
                                : "bg-stone-200 text-stone-600"
                            }`}
                          >
                            {manual.ministerio}
                          </span>
                          {manual.corpo && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-stone-200 text-stone-600 max-w-[130px] truncate">
                              {manual.corpo}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-stone-800 truncate">{manual.titulo}</h4>
                        {manual.descricao && (
                          <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{manual.descricao}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={manual.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver PDF"
                          className="p-1.5 rounded-md hover:bg-stone-200 text-stone-400 hover:text-[#12233F] transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteManual(manual)}
                          disabled={deletingManualId === manual.id}
                          title="Eliminar Manual"
                          className="p-1.5 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

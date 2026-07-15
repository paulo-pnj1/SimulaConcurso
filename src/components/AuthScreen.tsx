import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Shield, User, GraduationCap, AlertCircle, Phone, Lock, UserCircle } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile } from "../types";
import { isAdminEmail } from "../config/admin";

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
}

type AccountMode = "candidate" | "admin";
type CandidateAction = "login" | "register";

// O Firebase Auth exige um "email" internamente. Para o candidato entrar só
// com o número de telemóvel, transformamos o número num email sintético
// (nunca mostrado ao candidato) que serve apenas de identificador técnico.
function telefoneParaEmailInterno(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `${digitos}@candidatos.simulador-angola.local`;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [accountMode, setAccountMode] = useState<AccountMode>("candidate");
  const [candidateAction, setCandidateAction] = useState<CandidateAction>("login");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Campos do candidato
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");

  // Campos do administrador (conta estática, gerida diretamente no Firebase Auth)
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSenha, setAdminSenha] = useState("");

  const friendlyAuthError = (err: any): string => {
    switch (err?.code) {
      case "auth/email-already-in-use":
        return "Já existe uma conta registada com este número de telemóvel. Tente entrar em vez de registar.";
      case "auth/weak-password":
        return "A senha deve ter pelo menos 6 caracteres.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Número/email ou senha incorretos.";
      case "auth/invalid-email":
        return "Número de telemóvel inválido.";
      case "auth/too-many-requests":
        return "Demasiadas tentativas. Aguarde um pouco antes de tentar novamente.";
      default:
        return err?.message || "Ocorreu um erro. Tente novamente.";
    }
  };

  // Registo de um novo candidato: telefone (obrigatório) + senha
  // (obrigatória) + nome (opcional). Cria a conta no Firebase Auth (usando
  // um email técnico derivado do telefone) e o respetivo documento em
  // Firestore, já pronto para o fluxo de ativação Premium manual.
  const handleCandidateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const telefoneLimpo = telefone.trim();
    if (telefoneLimpo.replace(/\D/g, "").length < 9) {
      setError("Introduza um número de telemóvel válido (com pelo menos 9 dígitos).");
      return;
    }
    if (senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      const emailInterno = telefoneParaEmailInterno(telefoneLimpo);
      const result = await createUserWithEmailAndPassword(auth, emailInterno, senha);

      const profile: UserProfile = {
        uid: result.user.uid,
        name: nome.trim() || "Candidato",
        email: emailInterno,
        telefone: telefoneLimpo,
        role: "candidate",
        isPremium: false,
        paymentStatus: "none",
      };

      await setDoc(doc(db, "users", result.user.uid), {
        uid: profile.uid,
        name: profile.name,
        email: profile.email,
        telefone: telefoneLimpo,
        role: "candidate",
        isPremium: false,
        paymentStatus: "none",
        createdAt: serverTimestamp(),
      });

      onAuthSuccess(profile);
    } catch (err: any) {
      console.error("Erro no registo do candidato:", err);
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Login de um candidato já registado, usando telefone + senha.
  const handleCandidateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const telefoneLimpo = telefone.trim();
    if (!telefoneLimpo || !senha) {
      setError("Introduza o número de telemóvel e a senha.");
      return;
    }

    setIsLoading(true);
    try {
      const emailInterno = telefoneParaEmailInterno(telefoneLimpo);
      const result = await signInWithEmailAndPassword(auth, emailInterno, senha);

      const userSnap = await getDoc(doc(db, "users", result.user.uid));
      if (!userSnap.exists()) {
        setError("Não encontrámos os dados desta conta. Contacte o administrador.");
        return;
      }
      const data = userSnap.data();
      onAuthSuccess({
        uid: result.user.uid,
        name: data.name || "Candidato",
        email: data.email,
        telefone: data.telefone,
        role: data.role || "candidate",
        isPremium: data.isPremium === true,
        premiumActivatedAt: data.premiumActivatedAt,
        paymentStatus: data.paymentStatus || "none",
        pendingSince: data.pendingSince,
      });
    } catch (err: any) {
      console.error("Erro no login do candidato:", err);
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Login do administrador: conta estática (email + senha) gerida
  // diretamente no Firebase Authentication. Não há registo público de admin.
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminEmail.trim() || !adminSenha) {
      setError("Introduza o email e a senha do administrador.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminSenha);

      if (!isAdminEmail(result.user.email)) {
        setError("Esta conta não tem permissões de administrador.");
        setIsLoading(false);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", result.user.uid));
      const profile: UserProfile = userSnap.exists()
        ? {
            uid: result.user.uid,
            name: userSnap.data().name || "Administrador",
            email: result.user.email || adminEmail,
            role: "admin",
            isPremium: true,
            paymentStatus: "none",
          }
        : {
            uid: result.user.uid,
            name: "Administrador",
            email: result.user.email || adminEmail,
            role: "admin",
            isPremium: true,
            paymentStatus: "none",
          };

      onAuthSuccess(profile);
    } catch (err: any) {
      console.error("Erro no login do administrador:", err);
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#E3D9C4] border-t-4 border-t-[#C89B3C] rounded-2xl p-8 shadow-md"
      >
        {/* Header Icon / Branding */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[#12233F] border-2 border-[#12233F] mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[#12233F]">
            Aceder ao Simulador
          </h2>
        </div>

        {/* Mode toggle: Candidato / Administrador */}
        <div className="grid grid-cols-2 gap-2 mb-6 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setAccountMode("candidate");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountMode === "candidate" ? "bg-white text-[#12233F] shadow-xs" : "text-stone-500"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Candidato
          </button>
          <button
            onClick={() => {
              setAccountMode("admin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountMode === "admin" ? "bg-white text-[#A62639] shadow-xs" : "text-stone-500"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Administrador
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {accountMode === "candidate" ? (
          <div>
            {/* Login / Registar sub-toggle */}
            <div className="flex text-xs font-bold mb-5 border-b border-[#E3D9C4]">
              <button
                onClick={() => {
                  setCandidateAction("login");
                  setError(null);
                }}
                className={`flex-1 pb-2.5 cursor-pointer transition-colors ${
                  candidateAction === "login"
                    ? "text-[#12233F] border-b-2 border-[#12233F]"
                    : "text-stone-400"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => {
                  setCandidateAction("register");
                  setError(null);
                }}
                className={`flex-1 pb-2.5 cursor-pointer transition-colors ${
                  candidateAction === "register"
                    ? "text-[#12233F] border-b-2 border-[#12233F]"
                    : "text-stone-400"
                }`}
              >
                Criar Conta
              </button>
            </div>

            <form
              onSubmit={candidateAction === "login" ? handleCandidateLogin : handleCandidateRegister}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1.5">Número de Telemóvel</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="Ex: 923 000 000"
                    className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  />
                </div>
              </div>

              {candidateAction === "register" && (
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1.5">
                    Nome <span className="text-stone-400 font-normal normal-case">(opcional)</span>
                  </label>
                  <div className="relative">
                    <UserCircle className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="O seu nome"
                      className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white text-sm font-bold py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading
                  ? "A processar..."
                  : candidateAction === "login"
                  ? "Entrar"
                  : "Criar Conta"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1.5">Email do Administrador</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                className="w-full bg-white border border-[#D8CBB0] rounded-xl px-4 py-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A62639]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1.5">Senha</label>
              <input
                type="password"
                value={adminSenha}
                onChange={(e) => setAdminSenha(e.target.value)}
                placeholder="••••••"
                className="w-full bg-white border border-[#D8CBB0] rounded-xl px-4 py-3 text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A62639]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#A62639] hover:bg-[#8A1F2F] text-white text-sm font-bold py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "A entrar..." : "Entrar como Administrador"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

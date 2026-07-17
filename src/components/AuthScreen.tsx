import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { GraduationCap, AlertCircle, Phone, Lock, UserCircle } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile } from "../types";
import { isAdminEmail } from "../config/admin";

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
}

type CandidateAction = "login" | "register";

// O Firebase Auth exige um "email" internamente. Para o candidato entrar só
// com o número de telemóvel, transformamos o número num email sintético
// (nunca mostrado ao candidato) que serve apenas de identificador técnico.
function telefoneParaEmailInterno(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `${digitos}@candidatos.simulador-angola.local`;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [candidateAction, setCandidateAction] = useState<CandidateAction>("login");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Este campo serve tanto para o número de telemóvel (candidatos) como,
  // sem qualquer indicação visual disso, para o email do administrador.
  // Não existe nenhum botão ou separador "Administrador" no ecrã: quem
  // souber o email e a senha certos entra automaticamente no painel.
  const [identifier, setIdentifier] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");

  const friendlyAuthError = (err: any): string => {
    switch (err?.code) {
      case "auth/email-already-in-use":
        return "Já existe uma conta registada com este número de telemóvel. Tente entrar em vez de registar.";
      case "auth/weak-password":
        return "A senha deve ter pelo menos 6 caracteres.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Número ou senha incorretos.";
      case "auth/invalid-email":
        return "Número de telemóvel inválido.";
      case "auth/too-many-requests":
        return "Demasiadas tentativas. Aguarde um pouco antes de tentar novamente.";
      default:
        return err?.message || "Ocorreu um erro. Tente novamente.";
    }
  };

  // Login do administrador: acontece automaticamente quando o identificador
  // introduzido é o email de admin configurado em src/config/admin.ts. Não
  // há nenhuma opção visível no ecrã para isto -  é apenas uma verificação
  // silenciosa das credenciais.
  const handleAdminLogin = async (email: string) => {
    const result = await signInWithEmailAndPassword(auth, email, senha);

    if (!isAdminEmail(result.user.email)) {
      setError("Esta conta não tem permissões de administrador.");
      return;
    }

    const userSnap = await getDoc(doc(db, "users", result.user.uid));
    const profile: UserProfile = {
      uid: result.user.uid,
      name: userSnap.exists() ? userSnap.data().name || "Administrador" : "Administrador",
      email: result.user.email || email,
      role: "admin",
      isPremium: true,
      paymentStatus: "none",
    };

    onAuthSuccess(profile);
  };

  // Login de um candidato já registado, usando telefone + senha.
  const handleCandidateLogin = async (telefoneLimpo: string) => {
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
  };

  // Ponto único de entrada para o botão "Entrar": decide, em silêncio, se é
  // um login de administrador (identifier == email de admin) ou de
  // candidato (identifier == telefone), sem qualquer seletor visível.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valor = identifier.trim();
    if (!valor || !senha) {
      setError("Introduza o número de telemóvel e a senha.");
      return;
    }

    setIsLoading(true);
    try {
      if (isAdminEmail(valor)) {
        await handleAdminLogin(valor);
      } else {
        await handleCandidateLogin(valor);
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Registo de um novo candidato: telefone (obrigatório) + senha
  // (obrigatória) + nome (opcional). Cria a conta no Firebase Auth (usando
  // um email técnico derivado do telefone) e o respetivo documento em
  // Firestore, já pronto para o fluxo de ativação Premium manual.
  const handleCandidateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const telefoneLimpo = identifier.trim();
    if (isAdminEmail(telefoneLimpo)) {
      setError("Este identificador não pode ser usado para criar uma conta de candidato.");
      return;
    }
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

  return (
    <div className="max-w-md mx-auto px-4 py-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#E3D9C4] border-t-4 border-t-[#C89B3C] rounded-2xl p-5 sm:p-8 shadow-md"
      >
        {/* Header Icon / Branding */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto flex items-center justify-center text-[#12233F] border-2 border-[#12233F] mb-3 sm:mb-4">
            <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#12233F]">
            Aceder à Plataforma
          </h2>
        </div>

        {/* Login / Registar */}
        <div className="flex text-xs font-bold mb-5 border-b border-[#E3D9C4]">
          <button
            onClick={() => {
              setCandidateAction("login");
              setError(null);
            }}
            className={`flex-1 pb-2.5 cursor-pointer transition-colors ${
              candidateAction === "login" ? "text-[#12233F] border-b-2 border-[#12233F]" : "text-stone-400"
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
              candidateAction === "register" ? "text-[#12233F] border-b-2 border-[#12233F]" : "text-stone-400"
            }`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={candidateAction === "login" ? handleLogin : handleCandidateRegister} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-600 block mb-1.5">Número de Telemóvel</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ex: 923 000 000"
                className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-base sm:text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
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
                  className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-base sm:text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
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
                className="w-full bg-white border border-[#D8CBB0] rounded-xl pl-10 pr-4 py-3 text-base sm:text-sm text-[#201C16] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12233F]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#12233F] hover:bg-[#0C1A2E] text-white text-sm font-bold py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "A processar..." : candidateAction === "login" ? "Entrar" : "Criar Conta"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

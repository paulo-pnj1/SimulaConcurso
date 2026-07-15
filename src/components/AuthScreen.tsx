import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Shield, User, GraduationCap, LogIn, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (user: { uid: string; name: string; email: string; role: "admin" | "candidate" }) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to handle user document in Firestore
  const handleUserDocument = async (uid: string, email: string, displayName: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      // Determine role based on admin email from metadata
      const isAdminEmail = email.toLowerCase() === "pnjpaulo175@gmail.com";
      const role = isAdminEmail ? "admin" : "candidate";

      const userData = {
        uid,
        name: displayName || email.split("@")[0],
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      if (!userSnap.exists()) {
        // Save new user
        await setDoc(userRef, userData);
        return userData;
      } else {
        const existingData = userSnap.data();
        return {
          uid,
          name: existingData.name || userData.name,
          email: existingData.email || userData.email,
          role: existingData.role || userData.role,
        };
      }
    } catch (err: any) {
      console.error("Erro ao salvar perfil do utilizador:", err);
      // Fallback in case Firestore rules prevent access during initial setup
      const isAdminEmail = email.toLowerCase() === "pnjpaulo175@gmail.com";
      return {
        uid,
        name: displayName || email.split("@")[0],
        email,
        role: isAdminEmail ? ("admin" as const) : ("candidate" as const),
      };
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user && result.user.email) {
        const profile = await handleUserDocument(
          result.user.uid,
          result.user.email,
          result.user.displayName || ""
        );
        onAuthSuccess(profile as any);
      } else {
        throw new Error("Não foi possível obter o email da conta Google.");
      }
    } catch (err: any) {
      console.error("Erro no Login Google:", err);
      if (err.code === "auth/popup-blocked") {
        setError(
          "O popup de autenticação foi bloqueado pelo navegador. Por favor, permita popups para este site ou abra a aplicação num novo separador."
        );
      } else if (err.code === "auth/iframe-auth-html-error") {
        setError(
          "Erro de iframe detetado. Devido às restrições de segurança do iframe do AI Studio, utilize os botões de simulação/teste abaixo para navegar na aplicação."
        );
      } else {
        setError(err.message || "Erro desconhecido ao autenticar com a Google.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Safe Demo Logins for previewing and testing inside sandboxed environment
  const handleDemoLogin = async (role: "admin" | "candidate") => {
    setIsLoading(true);
    setError(null);
    // Mimic standard profile delay
    setTimeout(async () => {
      const isCandidate = role === "candidate";
      const demoUser = {
        uid: isCandidate ? "demo-candidate-123" : "demo-admin-456",
        name: isCandidate ? "Candidato de Teste" : "Administrador (Paulo)",
        email: isCandidate ? "candidato@concurso.ao" : "pnjpaulo175@gmail.com",
        role: role,
      };
      setIsLoading(false);
      onAuthSuccess(demoUser);
    }, 600);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#E3D9C4] border-t-4 border-t-[#C89B3C] rounded-2xl p-8 shadow-md"
      >
        {/* Header Icon / Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[#12233F] border-2 border-[#12233F] mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[#12233F]">
            Aceder ao Simulador
          </h2>
          <p className="text-xs text-[#7A7060] mt-1.5 leading-relaxed">
            Entre na sua conta para registar as suas classificações, consultar o seu histórico de exames e aceder ao painel administrativo.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Nota de Autenticação</span>
              {error}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Main Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-stone-50 text-stone-700 font-semibold border border-[#D8CBB0] py-3 px-4 rounded-xl text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.19-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? "A carregar..." : "Entrar com a Conta Google"}</span>
          </button>

          {/* Separation line */}
          <div className="relative my-6 flex items-center justify-center">
            <span className="absolute inset-x-0 h-px bg-[#E3D9C4]" />
            <span className="relative bg-white px-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Ambiente de Simulação
            </span>
          </div>

          {/* Quick Demo Access (Admins & Candidates) */}
          <div className="grid grid-cols-2 gap-3.5">
            <button
              onClick={() => handleDemoLogin("candidate")}
              disabled={isLoading}
              className="flex flex-col items-center justify-center p-3 border border-[#E3D9C4] hover:border-[#12233F] bg-stone-50 hover:bg-stone-50/50 rounded-xl transition-all cursor-pointer group text-center"
            >
              <User className="w-5 h-5 text-stone-500 group-hover:text-[#12233F] mb-1.5" />
              <span className="text-xs font-bold text-stone-800">Modo Candidato</span>
              <span className="text-[9px] text-stone-400 mt-0.5">Testar como aluno</span>
            </button>

            <button
              onClick={() => handleDemoLogin("admin")}
              disabled={isLoading}
              className="flex flex-col items-center justify-center p-3 border border-[#E3D9C4] hover:border-[#A62639] bg-stone-50 hover:bg-stone-50/50 rounded-xl transition-all cursor-pointer group text-center"
            >
              <Shield className="w-5 h-5 text-stone-500 group-hover:text-[#A62639] mb-1.5" />
              <span className="text-xs font-bold text-stone-800">Modo Admin</span>
              <span className="text-[9px] text-stone-400 mt-0.5">Gerir perguntas</span>
            </button>
          </div>
        </div>

        {/* Informative Footer */}
        <div className="mt-8 pt-4 border-t border-stone-100 text-center">
          <p className="text-[10px] text-stone-400 leading-normal">
            As contas de demonstração guardam dados locais ou de simulação para permitir testes ágeis sem necessidade de credenciais.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

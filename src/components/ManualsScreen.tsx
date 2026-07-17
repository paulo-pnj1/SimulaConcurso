import React, { useEffect, useState } from "react";
import { ArrowLeft, FileText, Download, BookOpen, Shield, HeartPulse, Globe } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Manual, UserProfile } from "../types";

interface ManualsScreenProps {
  currentUser: UserProfile;
  onBack: () => void;
}

function ministerioIcon(ministerio: Manual["ministerio"]) {
  if (ministerio === "MININT") return <Shield className="w-4 h-4" />;
  if (ministerio === "MINSA") return <HeartPulse className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

export default function ManualsScreen({ currentUser, onBack }: ManualsScreenProps) {
  const [manuais, setManuais] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManuais = async () => {
      setLoading(true);
      setError(null);
      try {
        const manuaisRef = collection(db, "manuais");
        const q = query(manuaisRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const fetched: Manual[] = [];
        snapshot.forEach((docSnap) => fetched.push(docSnap.data() as Manual));
        setManuais(fetched);
      } catch (err: any) {
        console.error("Erro ao carregar manuais:", err);
        setError(
          "Não foi possível carregar os manuais. Isto pode acontecer se o seu acesso Premium ainda não estiver ativo."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchManuais();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-[#12233F] mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar</span>
      </button>

      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center justify-center space-x-2 bg-[#E3D9C4] text-[#5C5346] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-[#D8CBB0]">
          <BookOpen className="w-4 h-4" />
          <span>Biblioteca de Preparação</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#12233F] mb-3">
          Manuais de Estudo
        </h1>
        <p className="text-sm md:text-base text-[#7A7060] max-w-2xl mx-auto leading-relaxed">
          Descarregue os manuais em PDF preparados para o seu concurso. Pode guardá-los no telemóvel e consultar
          mesmo sem internet.
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center text-stone-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-400 mx-auto mb-3"></div>
          A carregar manuais disponíveis...
        </div>
      )}

      {!loading && error && (
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && manuais.length === 0 && (
        <div className="max-w-lg mx-auto text-center py-16">
          <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-400 leading-relaxed">
            Ainda não há manuais disponíveis. Volte a verificar em breve -  a equipa está a preparar o material de
            estudo.
          </p>
        </div>
      )}

      {!loading && !error && manuais.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {manuais.map((manual) => (
            <div
              key={manual.id}
              className="bg-white border border-[#E3D9C4] rounded-xl p-5 shadow-xs flex flex-col hover:border-[#12233F] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-stone-100 text-[#12233F] rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="flex items-center gap-1 text-[9px] font-bold text-[#12233F] bg-stone-100 px-2 py-1 rounded-full uppercase tracking-wider">
                  {ministerioIcon(manual.ministerio)}
                  {manual.ministerio}
                  {manual.corpo ? ` · ${manual.corpo}` : ""}
                </span>
              </div>

              <h3 className="font-display text-base font-semibold text-[#12233F] mb-1.5 leading-snug">
                {manual.titulo}
              </h3>
              {manual.descricao && (
                <p className="text-xs text-[#7A7060] leading-relaxed mb-4 flex-grow">{manual.descricao}</p>
              )}

              <a
                href={manual.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center justify-center gap-2 bg-[#12233F] hover:bg-[#0C1A2E] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Abrir / Descarregar PDF</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

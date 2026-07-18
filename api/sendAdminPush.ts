import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { getDb } from "./_lib/admin.js";
import { requireAuth } from "./_lib/auth.js";

/**
 * POST /api/sendAdminPush
 *
 * Chamado pelo cliente (candidato autenticado) imediatamente depois de
 * gravar paymentStatus: "pending" em Firestore. Envia uma notificação push
 * para todas as subscrições guardadas em pushSubscriptions/* (na prática,
 * só a do admin, que é o único que ativa notificações no painel).
 *
 * Requer as env vars VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 * definidas no Vercel (Project Settings -> Environment Variables).
 *
 * Não confiamos no corpo do pedido para o nome do candidato - vamos sempre
 * buscar o perfil real a Firestore a partir do uid do token, para que um
 * candidato não possa forjar o texto da notificação do admin.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const { uid } = await requireAuth(req);
    const db = getDb();

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as { name?: string; email?: string }) : undefined;
    const candidateName = userData?.name || userData?.email || "Um candidato";

    // Chave pública VAPID: NÃO é secreta (é enviada ao browser do candidato
    // durante a subscrição), por isso está fixa aqui e em src/lib/push.ts em
    // vez de exigir mais uma env var no Vercel. Só a privada tem de ser
    // secreta e vem de process.env.VAPID_PRIVATE_KEY.
    const publicKey = "BDeV1ZkKDa_zmPM2fcnlM0TOofRV3sBGEmiUekrqq1nL5Meoe84pJquOFgOCztOa_64rZcoD-yh82_4N-9KOZkU";
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@estudabue.app";

    if (!privateKey) {
      // Não bloqueia o fluxo do candidato: o "Já Paguei" já foi gravado em
      // Firestore antes disto ser chamado. Só a notificação em si falha.
      console.error("sendAdminPush: VAPID_PRIVATE_KEY não configurada no servidor.");
      res.status(200).json({ sent: 0, warning: "VAPID_PRIVATE_KEY não configurada no servidor." });
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const subsSnap = await db.collection("pushSubscriptions").get();
    console.log(`sendAdminPush: ${subsSnap.size} subscrição(ões) encontrada(s) em pushSubscriptions.`);
    if (subsSnap.empty) {
      res.status(200).json({ sent: 0, warning: "Nenhum dispositivo admin subscrito." });
      return;
    }

    const payload = JSON.stringify({
      title: "Novo pagamento por confirmar",
      body: `${candidateName} clicou em "Já Paguei". Verifica o comprovativo no WhatsApp e ativa o acesso.`,
      url: "/",
      tag: "estudabue-payment",
    });

    let sent = 0;
    const staleDocIds: string[] = [];

    await Promise.all(
      subsSnap.docs.map(async (docSnap) => {
        const data = docSnap.data() as { subscription?: webpush.PushSubscription };
        if (!data.subscription) {
          console.error(`sendAdminPush: doc ${docSnap.id} não tem campo 'subscription'.`);
          return;
        }
        try {
          await webpush.sendNotification(data.subscription as any, payload);
          sent++;
          console.log(`sendAdminPush: enviado com sucesso para ${docSnap.id}.`);
        } catch (e: any) {
          console.error(
            `sendAdminPush: falha a enviar para ${docSnap.id} - statusCode=${e?.statusCode} body=${e?.body} message=${e?.message}`
          );
          // 404/410 = subscrição expirada ou cancelada pelo browser: limpa.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            staleDocIds.push(docSnap.id);
          }
        }
      })
    );

    if (staleDocIds.length > 0) {
      await Promise.all(staleDocIds.map((id) => db.collection("pushSubscriptions").doc(id).delete()));
    }

    console.log(`sendAdminPush: concluído, sent=${sent} de ${subsSnap.size}.`);
    res.status(200).json({ sent });
  } catch (e: any) {
    console.error("Erro ao enviar notificação push:", e);
    res.status(e?.status || 200).json({ sent: 0, error: e?.message || String(e) });
  }
}

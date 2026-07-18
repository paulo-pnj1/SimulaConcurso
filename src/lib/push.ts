import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

// Chave pública VAPID (não é secreta - pode ficar no bundle do cliente).
// A chave PRIVADA fica só no servidor, em process.env.VAPID_PRIVATE_KEY
// (ver api/sendAdminPush.ts). Se alguma vez gerares um novo par de chaves
// (ex.: `npx web-push generate-vapid-keys`), atualiza as DUAS aqui e lá.
export const VAPID_PUBLIC_KEY =
  "BDeV1ZkKDa_zmPM2fcnlM0TOofRV3sBGEmiUekrqq1nL5Meoe84pJquOFgOCztOa_64rZcoD-yh82_4N-9KOZkU";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Pede permissão de notificações ao browser, subscreve o Push Manager, e
 * guarda a subscrição em Firestore (pushSubscriptions/{uid}) para que o
 * endpoint /api/sendAdminPush a encontre depois. Guardamos SEMPRE com o
 * uid do admin autenticado como id do documento: um admin com várias
 * abas/dispositivos só mantém a subscrição mais recente (suficiente para
 * este caso de uso de "conta única de administrador").
 */
export async function subscribeAdminToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Este navegador não suporta notificações push.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("É necessário iniciar sessão.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificações recusada.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await setDoc(doc(db, "pushSubscriptions", user.uid), {
    uid: user.uid,
    subscription: subscription.toJSON(),
    updatedAt: new Date().toISOString(),
  });
}

/** Cancela a subscrição no browser e remove o registo em Firestore. */
export async function unsubscribeAdminFromPush(): Promise<void> {
  const user = auth.currentUser;
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe().catch(() => {});
  }
  if (user) await deleteDoc(doc(db, "pushSubscriptions", user.uid)).catch(() => {});
}

/** Verifica se já existe uma subscrição ativa neste browser. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * IMPORTANT: this value must be kept in sync with:
 *   - functions/src/config.ts     (Cloud Functions)
 *   - firestore.rules -> isAdmin()  (cannot import JS, must be edited by hand)
 *
 * Firestore security rules cannot import this file, so the email is
 * duplicated there on purpose. If you ever change the admin account, update
 * all three places.
 */
export const ADMIN_EMAIL = "pnjpaulo175@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

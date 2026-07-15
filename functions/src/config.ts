/**
 * IMPORTANT: this value must be kept in sync with:
 *   - src/config/admin.ts        (frontend)
 *   - firestore.rules -> isAdmin()  (cannot import JS, must be edited by hand)
 *
 * Only one source of truth is not possible across Firestore rules (which run
 * in a sandboxed language) and the app code, so this constant exists in both
 * places on purpose. If you ever change the admin email, update all three.
 */
export const ADMIN_EMAIL = "pnjpaulo175@gmail.com";

export const PREMIUM_CONFIG = {
  freeQuestionLimit: 2,
};

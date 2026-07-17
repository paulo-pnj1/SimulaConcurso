<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/138ed895-78ac-49cf-b117-eb5f867c21cb

## Run Locally

**Prerequisites:** Node.js 20+, and the [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`) if you want to deploy.

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

No `.env` secrets are required - the Firebase client config in `src/firebase-applet-config.json` is public by design, and all privileged logic (grading exams, reading the answer key) runs server-side in Cloud Functions.

### Firebase Console setup (one-time)

- Enable the **Email/Password** sign-in provider in Firebase Console → Authentication → Sign-in method. This is used for both candidate accounts (phone number → internal technical email) and the admin account - there is no Google Sign-In anymore.
- Create the admin account manually in Firebase Console → Authentication → Users, using the real email set in `src/config/admin.ts` / `functions/src/config.ts` / `firestore.rules`, and a password of your choice. That's the "conta estática" the admin logs in with.

## Cloud Functions (exam grading)

The correct answers to every question never reach the browser until *after*
an exam is submitted and graded. This is enforced by two callable Cloud
Functions in `/functions`:

- `getExamQuestions` - returns the question set for a ministry with
  `resposta`/`explicacao` stripped out. Only candidates with `isPremium: true`
  (or the admin) get the questions at all; there is no free-trial subset.
- `submitExam` - grades the candidate's answers against the real answer key
  (which only this function can see) and writes the result to Firestore.
  The client can no longer write to the `resultados` collection directly.

To deploy them to your Firebase project:

```
firebase login
cd functions && npm install && cd ..
npm run deploy:functions   # deploy just the functions
npm run deploy:rules       # deploy the updated firestore.rules
# or, to deploy hosting + functions + rules together:
npm run deploy
```

The project alias is set in `.firebaserc` (`concurso-b79f0`). If you deploy
to a different Firebase project, update that file first.

## Known limitations / next steps

- The admin account is currently identified by a hardcoded email
  (`src/config/admin.ts`, `functions/src/config.ts`, and
  `firestore.rules`). For multiple admins, switch to Firebase Auth
  [custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
  instead.
- Premium activation is manual (candidate pays via Multicaixa Express/bank
  transfer and sends proof over WhatsApp; the admin then toggles
  `isPremium` in the dashboard, matching the candidate's registered phone
  number against the payer number on the transfer). There's no automated
  payment verification yet.
- Candidates log in with phone number + password (no Google Sign-In). There
  is currently no "forgot password" flow - if a candidate loses their
  password, the admin needs to reset it manually from Firebase Console →
  Authentication → Users, or have them register again with the same phone
  number after the old account is deleted.
- `AdminDashboard.tsx` is a large single file (~1160 lines) covering
  question management, candidate/premium management, and results. It works
  and type-checks, but would benefit from being split into smaller
  components in a follow-up pass with UI testing/screenshots to confirm
  nothing shifts visually.

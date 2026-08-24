// UX-only list — this is NOT the security boundary. It just lets the UI show a
// clear "you're signed in but not an admin" message instead of a blank dashboard
// full of permission-denied errors for a non-admin account.
//
// The real enforcement lives in firestore.rules' isAdmin() function, which MUST
// list these exact same emails — if the two lists drift, the UI and the actual
// access control disagree, and the rules always win. Update both together.
export const ADMIN_EMAILS: string[] = [
  'better4business99@gmail.com',
];

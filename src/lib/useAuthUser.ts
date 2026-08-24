import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Reactively tracks the signed-in Firebase user via onAuthStateChanged, instead of
// reading auth.currentUser synchronously inside a mount-time effect.
//
// auth.currentUser is null until the SDK finishes restoring the persisted session from
// AsyncStorage (initializeAuth's persistence restore is asynchronous). A `useEffect(fn, [])`
// that reads auth.currentUser?.uid once at mount can run before that restore completes,
// see uid === undefined, bail out, and — because it never re-runs — permanently skip
// subscribing to anything for the lifetime of that component instance. This hook re-renders
// consumers once the real user resolves, so effects keyed on `user` correctly re-run.
export function useAuthUser(): { user: User | null; authChecked: boolean } {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authChecked, setAuthChecked] = useState(auth.currentUser !== null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  return { user, authChecked };
}

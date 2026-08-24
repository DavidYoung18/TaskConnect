import {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  FirestoreError,
  getDoc,
} from 'firebase/firestore';

// Firestore's onSnapshot does NOT automatically retry a 'permission-denied' error, even when
// it's caused by a transient race rather than an actual rules violation. The most common such
// race: a listener is established a beat before the Firebase Auth ID token has finished
// propagating to Firestore's own connection after a fresh sign-in / persisted-session restore
// (initializeAuth's AsyncStorage restore, and the token exchange that follows it, are both
// async — see useAuthUser.ts). onAuthStateChanged can fire, and a component can read a
// non-null `user`, slightly before Firestore's request layer actually has a valid token to
// attach to a new listener's request.
//
// Firestore treats permission-denied as terminal by design (repeating an actual rules
// violation is pointless), so the stream just dies — the snapshot callback never fires again,
// and the screen is stuck on whatever it last rendered (often nothing) until it remounts. That
// race window is narrow during a normal login → navigate flow (auth has time to settle before
// the next screen's listener mounts) but is much easier to hit during a compressed flow — e.g.
// a push notification tap causing a cold start straight into a deep-linked screen, where far
// less time has passed since auth resolved.
//
// This wraps a raw onSnapshot call with a few retries on exactly that error code, giving the
// token race a chance to resolve instead of leaving the UI silently stuck until a full
// logout/login remounts everything from scratch.
export function subscribeWithRetry<T>(
  subscribe: (onNext: (data: T) => void, onError: (error: FirestoreError) => void) => () => void,
  onNext: (data: T) => void,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    onError?: (error: FirestoreError) => void;
  },
): () => void {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 800;

  let cancelled = false;
  let unsubscribeCurrent: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function attempt(retryCount: number) {
    unsubscribeCurrent = subscribe(onNext, (error) => {
      options?.onError?.(error);
      if (cancelled) return;
      if (error.code === 'permission-denied' && retryCount < maxRetries) {
        retryTimer = setTimeout(() => attempt(retryCount + 1), baseDelayMs * (retryCount + 1));
      }
    });
  }

  attempt(0);

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    unsubscribeCurrent?.();
  };
}

// getDoc() has no built-in retry — if Firestore is briefly unreachable (e.g. app cold-starting
// before the device's network stack is up, or a momentary connectivity blip) it just throws once
// with code 'unavailable' ("Failed to get document because the client is offline") and never
// tries again on its own. This app's Firestore instance also has no offline persistence
// configured (getFirestore(app) with no localCache option — see src/lib/firebase.ts), so there's
// no local cache for getDoc() to fall back to either; the only way to recover is to wait a beat
// for connectivity and actually retry the read.
//
// This matters most for a one-shot read gating app startup (e.g. _layout.tsx's auth-check
// getDoc): with no retry, a caller that doesn't guard against the throw can be left permanently
// stuck (e.g. a loading spinner that only clears once the read resolves, one way or the other).
export async function getDocWithRetry<T = DocumentData>(
  ref: DocumentReference<T>,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<DocumentSnapshot<T>> {
  const maxRetries = options?.maxRetries ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  for (let attempt = 0; ; attempt++) {
    try {
      return await getDoc(ref);
    } catch (error) {
      const code = (error as FirestoreError)?.code;
      if (code !== 'unavailable' || attempt >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
}

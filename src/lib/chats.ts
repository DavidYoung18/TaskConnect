import {
  addDoc,
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Booking } from '@/lib/bookings';
import { sendPushNotification } from '@/lib/notifications';
import { subscribeWithRetry } from '@/lib/firestoreSubscribe';

export interface Chat {
  id: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  lastMessage: string;
  // Set only when the last message was a system message (see sendSystemMessage) —
  // lets the chat list re-translate the preview into whatever language the CURRENT
  // reader has active, instead of showing lastMessage verbatim (which is frozen in
  // whichever language the sender had active the moment it was written). Absent for
  // ordinary user-typed messages, and for any chat whose last message predates this
  // field's existence — both cases fall back to showing lastMessage as-is, same as
  // before.
  lastMessageType?: string;
  lastMessageAt: any;
  bookingId: string;
  categoryId?: string; // absent on chats created before this field existed
  // uid → Firestore Timestamp. Prior to the dot-path-key fix in sendMessage()/
  // markChatAsRead(), this map was never actually populated by any code path
  // (writes silently landed in a bogus top-level "lastReadBy.<uid>" field instead) —
  // so any chat doc that predates the fix will have this fully absent, not
  // populated-but-wrong. Absent is treated as "never read" by getUnreadCountForChat.
  lastReadBy?: Record<string, any>;
}

// The exact set of `type` values sendSystemMessage is ever called with (see every
// call site: booking-detail.tsx, provider/booking-detail.tsx, chat-thread.tsx,
// rescheduleActions.ts) mapped to the chatThread.* key that renders it — the SAME
// key each call site already passes t() to build the one-time previewText. Kept
// here, not duplicated in both chat list screens, so the two can't drift apart.
const SYSTEM_MESSAGE_PREVIEW_KEYS: Record<string, string> = {
  completion_request: 'chatThread.completionRequestText',
  completion_confirmed: 'chatThread.jobMarkedComplete',
  completion_declined: 'chatThread.completionDeclinedText',
  reschedule_requested: 'chatThread.rescheduleRequestedText',
  reschedule_accepted: 'chatThread.rescheduleAcceptedText',
  reschedule_declined: 'chatThread.rescheduleDeclinedText',
  reschedule_unavailable: 'chatThread.rescheduleUnavailableText',
};

export function getSystemMessagePreviewKey(type: string): string | undefined {
  return SYSTEM_MESSAGE_PREVIEW_KEYS[type];
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  type?: string;
  payload?: Record<string, any>;
  sentAt: any;
}

export function subscribeToChats(
  uid: string,
  role: 'customer' | 'provider',
  callback: (chats: Chat[]) => void,
): () => void {
  const field = role === 'customer' ? 'customerId' : 'providerId';
  return subscribeWithRetry<Chat[]>(
    (onNext, onError) => {
      const q = query(collection(db, 'chats'), where(field, '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const chats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, 'id'>) }));
          chats.sort((a, b) => {
            const aTime = a.lastMessageAt?.toMillis?.() ?? 0;
            const bTime = b.lastMessageAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });
          onNext(chats);
        },
        onError,
      );
    },
    callback,
    { onError: (error) => console.error('subscribeToChats failed:', error) },
  );
}

export async function getOrCreateChatForBooking(booking: Booking): Promise<void> {
  const ref = doc(db, 'chats', booking.id);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    customerId: booking.customerId,
    customerName: booking.customerName,
    providerId: booking.providerId,
    providerName: booking.providerName,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    bookingId: booking.id,
    categoryId: booking.categoryId,
  });
}

export async function createChatForBooking(booking: Booking): Promise<void> {
  await setDoc(doc(db, 'chats', booking.id), {
    customerId: booking.customerId,
    customerName: booking.customerName,
    providerId: booking.providerId,
    providerName: booking.providerName,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    bookingId: booking.id,
    categoryId: booking.categoryId,
  });
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<void> {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId,
    text,
    sentAt: serverTimestamp(),
  });
  // setDoc + merge instead of updateDoc — updateDoc throws "No document to update" if the
  // chat doc hasn't been created yet (or was deleted), which merge safely creates/fills in.
  //
  // lastReadBy MUST be a nested object here, not a dot-path string key like
  // `[`lastReadBy.${senderId}`]`. That was the actual bug behind chats never clearing
  // as read: dot-path string keys are only expanded into nested field paths by
  // updateDoc()'s parameter parsing — setDoc() (merge or not) takes the object
  // literally, so a string key containing a dot creates one literal top-level field
  // named e.g. "lastReadBy.abc123" instead of setting `abc123` inside the `lastReadBy`
  // map. chat.lastReadBy stayed permanently undefined as a result, which made
  // isChatUnread() return true forever. A nested object IS still merged correctly —
  // setDoc's merge applies recursively to nested map fields, only touching the
  // specified key and preserving any other uids already in lastReadBy (verified
  // empirically before relying on it here).
  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: text,
      // Clears any lastMessageType a prior system message left behind — otherwise
      // the chat list would keep re-translating THIS real, human-typed message as
      // if it were that earlier system message's preview.
      lastMessageType: deleteField(),
      lastMessageAt: serverTimestamp(),
      lastReadBy: { [senderId]: serverTimestamp() },
    },
    { merge: true },
  );

  try {
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    const chat = chatSnap.data() as Omit<Chat, 'id'> | undefined;
    if (!chat) return;

    const isSenderCustomer = senderId === chat.customerId;
    const recipientId = isSenderCustomer ? chat.providerId : chat.customerId;
    const senderName = isSenderCustomer ? chat.customerName : chat.providerName;

    const recipientSnap = await getDoc(doc(db, 'users', recipientId));
    const token = recipientSnap.data()?.pushToken;
    if (token) {
      await sendPushNotification(token, 'New Message', `${senderName}: ${text}`, {
        type: 'chat',
        chatId,
        otherPartyName: senderName,
      });
    }
  } catch {
    // Notification failures shouldn't block message sending
  }
}

export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
): () => void {
  return subscribeWithRetry<Message[]>(
    (onNext, onError) => {
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('sentAt', 'asc'),
      );
      return onSnapshot(
        q,
        (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))),
        onError,
      );
    },
    callback,
    { onError: (error) => console.error('subscribeToMessages failed:', error) },
  );
}

export async function sendSystemMessage(
  chatId: string,
  type: string,
  payload: Record<string, any>,
  // Still stored as a plain-text fallback (for chats predating lastMessageType, and
  // for any future system type that's not in SYSTEM_MESSAGE_PREVIEW_KEYS) — but
  // lastMessageType below is what the chat list actually prefers when present, since
  // it can be re-translated for whoever's currently reading it, where this frozen
  // string can't be.
  previewText: string,
): Promise<void> {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId: 'system',
    type,
    payload,
    sentAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: previewText,
      lastMessageType: type,
      lastMessageAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function markChatAsRead(chatId: string, uid: string): Promise<void> {
  // serverTimestamp() (not a client-computed ISO string) is required here — this
  // value gets compared against messages' sentAt (also serverTimestamp()) via a
  // Firestore range query in getUnreadCountForChat below. Firestore range/inequality
  // filters require both sides to be the same type; a stored ISO string would make
  // that query silently return wrong (usually zero) results instead of erroring, and
  // would also be vulnerable to client/server clock skew that a real Timestamp isn't.
  //
  // lastReadBy MUST be a nested object, not a dot-path string key — see the long
  // comment in sendMessage() above for why: dot-path string keys passed to setDoc()
  // (even with merge:true) are stored as one literal field named e.g.
  // "lastReadBy.abc123" instead of setting `abc123` inside the `lastReadBy` map. This
  // was the actual root cause of both reported bugs — chat.lastReadBy was never
  // actually being written, at all, by any code path, so isChatUnread() always saw
  // it as undefined and returned true forever, no matter how many times a chat was
  // opened and read.
  //
  // Also retried and never throws — this was previously called fire-and-forget with
  // no await/catch at its call site (chat-thread.tsx mount), so any transient failure
  // (e.g. the same auth-token-propagation race documented in firestoreSubscribe.ts,
  // easy to hit if a notification tap cold-starts the app straight into this screen)
  // would silently and permanently never mark that chat read.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await setDoc(
        doc(db, 'chats', chatId),
        { lastReadBy: { [uid]: serverTimestamp() } },
        { merge: true },
      );
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('markChatAsRead failed after retries:', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

// Actual per-chat unread message count for a user — counts messages sent after
// their lastReadBy timestamp for this chat (or every message, if they've never
// read it). Used for the numeric badge on each chat list row.
export async function getUnreadCountForChat(chatId: string, since: unknown): Promise<number> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = since
    ? query(messagesRef, where('sentAt', '>', since))
    : query(messagesRef);
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export function subscribeToUnreadChatCount(
  uid: string,
  role: 'customer' | 'provider',
  callback: (count: number) => void,
): () => void {
  const field = role === 'customer' ? 'customerId' : 'providerId';
  let latestRequestId = 0;
  return subscribeWithRetry<number>(
    (onNext, onError) => {
      const q = query(collection(db, 'chats'), where(field, '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const requestId = ++latestRequestId;
          const chats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, 'id'>) }));
          // Uses the exact same message-level source of truth as
          // getUnreadCountForChat (the per-chat row badges), not the coarser
          // isChatUnread()/lastMessageAt heuristic that used to live here. That
          // heuristic treated ANY chat with a lastMessageAt and no personal
          // lastReadBy entry as unread — but lastMessageAt gets set the moment a
          // chat is *created* (getOrCreateChatForBooking/createChatForBooking),
          // before any actual message exists. A provider with several freshly
          // accepted, never-messaged bookings would see this badge count all of
          // them as unread while every row correctly showed 0 — this makes both
          // numbers derive from the same query, so they can't drift apart again.
          Promise.all(chats.map((c) => getUnreadCountForChat(c.id, c.lastReadBy?.[uid])))
            .then((counts) => {
              if (requestId !== latestRequestId) return; // superseded by a newer snapshot
              onNext(counts.filter((n) => n > 0).length);
            })
            .catch(onError);
        },
        onError,
      );
    },
    callback,
    {
      onError: (error) => {
        // A per-chat getUnreadCountForChat() aggregation query can still be in flight
        // (or its result still landing) the instant after signOut() clears the
        // session but before this listener's cleanup effect has unmounted — Firestore
        // then rejects it as permission-denied. Expected during that brief window, not
        // a real failure, so only log it if the user is actually still signed in.
        if (!auth.currentUser) return;
        console.error('subscribeToUnreadChatCount failed:', error);
      },
    },
  );
}

export async function getChatsForUser(
  uid: string,
  role: 'customer' | 'provider',
): Promise<Chat[]> {
  const field = role === 'customer' ? 'customerId' : 'providerId';
  const q = query(
    collection(db, 'chats'),
    where(field, '==', uid),
  );
  const snap = await getDocs(q);
  const chats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, 'id'>) }));
  return chats.sort((a, b) => {
    const aTime = a.lastMessageAt?.toMillis?.() ?? 0;
    const bTime = b.lastMessageAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

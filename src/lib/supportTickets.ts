import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeWithRetry } from '@/lib/firestoreSubscribe';

// Mirrors the shape/conventions of src/lib/chats.ts (chats/{id}/messages) — a
// support ticket is essentially a chat thread with a subject/status and a third
// possible sender (admin) instead of exactly two known participants.

export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketSenderType = 'customer' | 'provider' | 'admin';

export interface SupportTicket {
  id: string;
  userId: string;
  userType: 'customer' | 'provider';
  userName: string;
  subject: string;
  status: TicketStatus;
  createdAt: any;
  updatedAt: any;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderType: TicketSenderType;
  text: string;
  createdAt: any;
}

export async function createTicket(
  userId: string,
  userType: 'customer' | 'provider',
  userName: string,
  subject: string,
  firstMessage: string,
): Promise<string> {
  const ticketRef = await addDoc(collection(db, 'supportTickets'), {
    userId,
    userType,
    userName,
    subject,
    status: 'open' as TicketStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'supportTickets', ticketRef.id, 'messages'), {
    senderId: userId,
    senderType: userType,
    text: firstMessage,
    createdAt: serverTimestamp(),
  });

  return ticketRef.id;
}

export function subscribeToUserTickets(
  userId: string,
  callback: (tickets: SupportTicket[]) => void,
): () => void {
  return subscribeWithRetry<SupportTicket[]>(
    (onNext, onError) => {
      const q = query(
        collection(db, 'supportTickets'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
      );
      return onSnapshot(
        q,
        (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportTicket, 'id'>) }))),
        onError,
      );
    },
    callback,
    { onError: (error) => console.error('subscribeToUserTickets failed:', error) },
  );
}

export function subscribeToTicket(
  ticketId: string,
  callback: (ticket: SupportTicket | null) => void,
): () => void {
  return subscribeWithRetry<SupportTicket | null>(
    (onNext, onError) =>
      onSnapshot(
        doc(db, 'supportTickets', ticketId),
        (snap) => onNext(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<SupportTicket, 'id'>) } : null),
        onError,
      ),
    callback,
    { onError: (error) => console.error('subscribeToTicket failed:', error) },
  );
}

export function subscribeToTicketMessages(
  ticketId: string,
  callback: (messages: TicketMessage[]) => void,
): () => void {
  return subscribeWithRetry<TicketMessage[]>(
    (onNext, onError) => {
      const q = query(
        collection(db, 'supportTickets', ticketId, 'messages'),
        orderBy('createdAt', 'asc'),
      );
      return onSnapshot(
        q,
        (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TicketMessage, 'id'>) }))),
        onError,
      );
    },
    callback,
    { onError: (error) => console.error('subscribeToTicketMessages failed:', error) },
  );
}

export async function sendTicketMessage(
  ticketId: string,
  senderId: string,
  senderType: TicketSenderType,
  text: string,
  currentStatus: TicketStatus,
): Promise<void> {
  await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
    senderId,
    senderType,
    text,
    createdAt: serverTimestamp(),
  });

  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  // A resolved ticket getting a new message from the user (not admin) means the
  // issue isn't actually settled — reopen it automatically rather than leaving a
  // "Resolved" badge sitting next to a new unanswered message.
  if (senderType !== 'admin' && currentStatus === 'resolved') {
    updates.status = 'open' satisfies TicketStatus;
  }
  await updateDoc(doc(db, 'supportTickets', ticketId), updates);
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await updateDoc(doc(db, 'supportTickets', ticketId), { status, updatedAt: serverTimestamp() });
}

import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking, updateBookingStatus } from '@/lib/bookings';
import { sendSystemMessage } from '@/lib/chats';
import { sendPushNotification } from '@/lib/notifications';
import { createNotification } from '@/lib/inAppNotifications';
import { isSlotAvailable } from '@/lib/availability';

// Single source of truth for proposing/resolving a reschedule — shared by
// provider/booking-detail.tsx (propose, both the free-form cleaning picker and the
// availability-constrained slot picker used for every other category) and by
// booking-detail.tsx's card buttons / chat-thread.tsx's inline system-message
// buttons (accept/decline), so every surface does the exact same Firestore writes
// (booking status, system message, push notification), not copies that can drift.

async function notifyProvider(providerId: string, bookingId: string, title: string, body: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'users', providerId));
    const token = snap.data()?.pushToken;
    if (token) {
      await sendPushNotification(token, title, body, { type: 'booking', bookingId, role: 'provider' });
    }
  } catch {
    // Notification failures shouldn't block the reschedule decision
  }
}

async function notifyCustomer(customerId: string, bookingId: string, title: string, body: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'users', customerId));
    const token = snap.data()?.pushToken;
    if (token) {
      await sendPushNotification(token, title, body, { type: 'booking', bookingId, role: 'customer' });
    }
  } catch {
    // Notification failures shouldn't block the reschedule proposal
  }
}

// Provider-side: propose a new date/time for a booking — either one already
// 'confirmed', or (Request Reschedule doubling as the provider's response to a
// still-'pending' booking, skipping accept entirely) one that's still 'pending'.
// Called from provider/booking-detail.tsx — for cleaning-company bookings the caller
// sources proposedDate/proposedStartTime/proposedEndTime from the free-form
// date/time picker; for every other category it sources them from SlotPickerModal
// (the same availability-constrained picker used for new bookings), so a provider
// can only propose a time they're actually free for. Deliberately does NOT touch
// blockedSlots here — see acceptReschedule below for why the swap is deferred to
// approval time instead of happening immediately on proposal.
export async function proposeReschedule(
  booking: Booking,
  proposedDate: string,
  proposedStartTime: string,
  proposedEndTime: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): Promise<void> {
  await updateDoc(doc(db, 'bookings', booking.id), {
    status: 'reschedule_pending',
    proposedDate,
    proposedStartTime,
    proposedEndTime,
    // 'confirmed' means blockScheduleSlot already ran on accept — there's a real
    // blockedSlots entry at booking.scheduledDate/scheduledTime that'll need
    // releasing if this reschedule is accepted or declined. 'pending' means this
    // booking was never accepted, so nothing was ever blocked — see the two cleanup
    // effects in provider/booking-detail.tsx, which both branch on this.
    rescheduleHadBlockedSlot: booking.status === 'confirmed',
    customerViewed: false,
  });
  // originalDate/originalTime/proposedDate/proposedTime are captured here rather than
  // read live off the booking doc at render time — booking.proposedDate/proposedStartTime
  // get cleared (or overwrite scheduledDate/scheduledTime) once this request resolves,
  // so the chat bubble needs its own permanent copy to keep showing the Original/Proposed
  // times correctly after the fact, not just while still pending.
  await sendSystemMessage(
    booking.id,
    'reschedule_requested',
    {
      bookingId: booking.id,
      originalDate: booking.scheduledDate,
      originalTime: booking.scheduledTime,
      proposedDate,
      proposedTime: proposedStartTime,
    },
    t('chatThread.rescheduleRequestedText'),
  );
  await notifyCustomer(
    booking.customerId,
    booking.id,
    'Reschedule Requested',
    `${booking.providerName} requested to reschedule your booking for ${booking.serviceName}.`,
  );
  await createNotification({
    userId: booking.customerId,
    type: 'reschedule_proposed',
    bookingId: booking.id,
    providerName: booking.providerName,
  });
}

export type RescheduleAcceptResult = { ok: true } | { ok: false; reason: 'slot_unavailable' };

// Customer-side: approve a pending reschedule. For slot-based categories (anything
// but cleaning-company — cleaning has no blockedSlots concept, see handleAccept's
// skip in provider/booking-detail.tsx), this re-checks the proposed slot is still
// free right before committing: the provider proposed it without reserving it (no
// blockedSlots write happens until this point), so another booking could have taken
// it in the meantime. If it has, the booking reverts to 'confirmed' on its original
// schedule instead of silently double-booking, and the provider needs to propose a
// different time.
//
// The actual blockedSlots swap (release the original slot, claim the new one) can't
// happen from here — firestore.rules restricts blockedSlots writes to the owning
// provider, and this runs on the customer's client. previousScheduledDate/
// previousScheduledTime hand the old slot off to a provider-side effect
// (provider/booking-detail.tsx) that performs the swap the next time the provider's
// own client observes this booking.
export async function acceptReschedule(
  booking: Booking,
  t: (key: string, options?: Record<string, unknown>) => string,
): Promise<RescheduleAcceptResult> {
  if (!booking.proposedDate || !booking.proposedStartTime) return { ok: false, reason: 'slot_unavailable' };

  if (booking.type !== 'cleaning-company') {
    const available = await isSlotAvailable(booking.providerId, booking.proposedDate, booking.proposedStartTime);
    if (!available) {
      // Revert to whatever this reschedule cycle actually started from — 'confirmed'
      // if the booking was already accepted, but 'pending' if Request Reschedule was
      // used as the provider's direct response to a brand-new booking (see
      // rescheduleHadBlockedSlot). Hardcoding 'confirmed' here would silently
      // auto-accept a booking the provider never actually accepted.
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: booking.rescheduleHadBlockedSlot ? 'confirmed' : 'pending',
        proposedDate: deleteField(),
        proposedStartTime: deleteField(),
        proposedEndTime: deleteField(),
        rescheduleHadBlockedSlot: deleteField(),
      });
      await sendSystemMessage(
        booking.id,
        'reschedule_unavailable',
        { bookingId: booking.id },
        t('chatThread.rescheduleUnavailableText'),
      );
      await notifyProvider(
        booking.providerId,
        booking.id,
        'Proposed Time No Longer Available',
        `The time you proposed for ${booking.serviceName} is no longer available — please propose a different time.`,
      );
      return { ok: false, reason: 'slot_unavailable' };
    }
  }

  const updates: Record<string, unknown> = {
    status: 'confirmed',
    scheduledDate: booking.proposedDate,
    scheduledTime: booking.proposedStartTime,
    proposedDate: deleteField(),
    proposedStartTime: deleteField(),
    proposedEndTime: deleteField(),
    rescheduleHadBlockedSlot: deleteField(),
  };
  if (booking.type !== 'cleaning-company') {
    // needsBlockedSlotSync always fires the provider-side cleanup effect — it always
    // has a new slot to block. previousScheduledDate/previousScheduledTime are only
    // included when there's actually an old one to release too (rescheduleHadBlockedSlot
    // — false when this reschedule was proposed straight from a still-'pending'
    // booking, which was never blocked in the first place; see proposeReschedule).
    updates.needsBlockedSlotSync = true;
    if (booking.rescheduleHadBlockedSlot) {
      updates.previousScheduledDate = booking.scheduledDate;
      updates.previousScheduledTime = booking.scheduledTime;
    }
  }
  await updateDoc(doc(db, 'bookings', booking.id), updates);

  await sendSystemMessage(
    booking.id,
    'reschedule_accepted',
    { bookingId: booking.id },
    t('chatThread.rescheduleAcceptedText'),
  );
  await notifyProvider(
    booking.providerId,
    booking.id,
    'Reschedule Accepted',
    `${booking.customerName} accepted your reschedule request for ${booking.serviceName}.`,
  );
  return { ok: true };
}

// Customer-side: decline a pending reschedule — cancels the booking outright (same
// as the original cleaning-only behavior). proposedDate/proposedStartTime/
// proposedEndTime/rescheduleHadBlockedSlot are deliberately left in place as
// markers: the customer can't release the original blockedSlots entry themselves
// (owner-only, see above) — and there may not even BE one to release, if this
// reschedule was proposed straight from a still-'pending' booking. So
// provider/booking-detail.tsx's decline-cleanup effect reads rescheduleHadBlockedSlot
// to decide whether a release is needed at all, performs it (or doesn't) from the
// provider's own session the next time they view the booking, then clears the
// marker fields so it only runs once.
export async function declineReschedule(
  booking: Booking,
  t: (key: string, options?: Record<string, unknown>) => string,
): Promise<void> {
  await updateBookingStatus(booking.id, 'declined');
  await sendSystemMessage(
    booking.id,
    'reschedule_declined',
    { bookingId: booking.id },
    t('chatThread.rescheduleDeclinedText'),
  );
  await notifyProvider(
    booking.providerId,
    booking.id,
    'Reschedule Declined',
    `${booking.customerName} declined your reschedule request. The booking for ${booking.serviceName} has been cancelled.`,
  );
}

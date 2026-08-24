import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatMonthDay, formatWeekdayMonthDay } from '@/lib/dateFormat';

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS: Record<string, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
};

export interface TimeBlock {
  startTime: string;
  endTime: string;
  // Only set for manually-blocked days (provider proactively marking a single date
  // unavailable with no booking behind it, e.g. "I'm off next Wednesday") — omitted
  // for booking-caused blocks written by blockScheduleSlot() on accept, so existing
  // docs and every other reader of this field stay valid without a migration.
  reason?: 'manual';
}

export interface DayAvailability {
  day: string;
  isAvailable: boolean;
  blocks: TimeBlock[];
}

export async function getWeekAvailability(uid: string): Promise<Record<string, DayAvailability>> {
  const snap = await getDocs(collection(db, 'users', uid, 'availability'));

  const result: Record<string, DayAvailability> = {};

  for (const dayId of DAYS_OF_WEEK) {
    result[dayId] = { day: DAY_LABELS[dayId], isAvailable: false, blocks: [] };
  }

  for (const docSnap of snap.docs) {
    const dayId = docSnap.id;
    if (DAYS_OF_WEEK.includes(dayId)) {
      result[dayId] = docSnap.data() as DayAvailability;
    }
  }

  return result;
}

export async function saveDayAvailability(
  uid: string,
  dayId: string,
  data: DayAvailability,
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'availability', dayId), data);
}

// users/{uid}/blockedSlots/{dateStr} — one doc per calendar date, holding the
// time ranges already taken by confirmed bookings (so they're excluded from
// the slots offered to new customers).
export async function getBlockedSlots(uid: string, dateStr: string): Promise<TimeBlock[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'blockedSlots', dateStr));
  return snap.exists() ? ((snap.data().blocks as TimeBlock[]) ?? []) : [];
}

export async function addBlockedSlot(uid: string, dateStr: string, block: TimeBlock): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'blockedSlots', dateStr),
    { blocks: arrayUnion(block) },
    { merge: true },
  );
}

// Exact counterpart to addBlockedSlot — arrayRemove needs the exact same {startTime,
// endTime[, reason]} shape that was originally added. Used by the reschedule flow to
// free a booking's original slot (or a since-declined proposed slot) — always called from
// the provider's own client, matching firestore.rules (blockedSlots writes are owner-only).
export async function removeBlockedSlot(uid: string, dateStr: string, block: TimeBlock): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'blockedSlots', dateStr),
    { blocks: arrayRemove(block) },
    { merge: true },
  );
}

// ── Slot generation/filtering — shared by the new-booking slot picker
// (provider-profile-view.tsx / SlotPickerModal) and the reschedule flow's
// availability re-check (rescheduleActions.ts), so both agree on exactly the same
// definition of "free". Previously duplicated only inside provider-profile-view.tsx.

export const JS_DAY_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface AvailableDate {
  date: Date;
  dayKey: string;
  label: string;
  dateStr: string;
}

export function generateSlots(blocks: TimeBlock[]): string[] {
  const slots: string[] = [];
  for (const block of blocks) {
    const [sh, sm] = block.startTime.split(':').map(Number);
    const [eh, em] = block.endTime.split(':').map(Number);
    const firstHour = sm === 0 ? sh : sh + 1;
    const lastHour = Math.floor((eh * 60 + em - 60) / 60);
    for (let h = firstHour; h <= lastHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
  }
  return [...new Set(slots)].sort();
}

export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// For today only, hides slots starting within the next hour (rounded up to the next
// full hour) — a customer/provider shouldn't be able to (re)book a slot that's about
// to start or has already passed. Other dates are returned unfiltered.
export function filterSlotsForDate(slots: string[], dateStr: string): string[] {
  if (dateStr !== getTodayDateStr()) return slots;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = currentMinutes + 60;
  const cutoffHour = Math.ceil(cutoffMinutes / 60);
  return slots.filter((slot) => Number(slot.split(':')[0]) >= cutoffHour);
}

// A confirmed booking blocks not just its own time range but this many minutes on
// either side too — a provider isn't expected to start a new job the instant a
// previous one ends, or finish one the instant the next one starts. Fixed/global
// for now; see usage note if this needs to become per-provider or per-category later.
const BOOKING_BUFFER_MINUTES = 60;

// Adds (or subtracts, via a negative value) minutes to an "HH:mm" time, clamped to
// the current calendar day — avoids wrapping to a bogus time (e.g. "-0:30" or
// "24:30") that would silently break the string comparisons isSlotBlocked relies on.
function addMinutesClamped(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const clamped = Math.max(0, Math.min(total, 24 * 60 - 1));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

export function isSlotBlocked(slot: string, blocks: TimeBlock[]): boolean {
  return blocks.some((b) => {
    const bufferedStart = addMinutesClamped(b.startTime, -BOOKING_BUFFER_MINUTES);
    const bufferedEnd = addMinutesClamped(b.endTime, BOOKING_BUFFER_MINUTES);
    return slot >= bufferedStart && slot < bufferedEnd;
  });
}

export function getUpcomingDates(
  availability: Record<string, DayAvailability>,
  isCleaning: boolean,
  language: string,
  t: (key: string) => string,
): AvailableDate[] {
  const result: AvailableDate[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayKey = JS_DAY_KEY[d.getDay()];
    if (!availability[dayKey]?.isAvailable) continue;

    // Local date components, not toISOString() (UTC) — avoids the one-day shift
    // in positive-UTC-offset timezones like Tashkent (UTC+5).
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Today only makes the list if at least one hourly slot survives the 1-hour buffer.
    // Cleaning bookings don't use hourly slots, so this check doesn't apply to them.
    if (i === 0 && !isCleaning) {
      const todaySlots = filterSlotsForDate(generateSlots(availability[dayKey]?.blocks ?? []), dateStr);
      if (todaySlots.length === 0) continue;
    }

    const label = i === 0
      ? `${t('common.today')}, ${formatMonthDay(d, language)}`
      : i === 1
        ? `${t('common.tomorrow')}, ${formatMonthDay(d, language)}`
        : formatWeekdayMonthDay(d, language);
    result.push({ date: d, dayKey, label, dateStr });
  }
  return result;
}

// A provider proactively blocking a single date (no booking behind it) — reuses the
// same blockedSlots doc/array as booking-caused blocks, just tagged reason: 'manual' so
// the UI can tell the two apart. Spans the full day so it excludes that date from
// customer-facing slots regardless of whatever hours are configured for that weekday.
const MANUAL_DAY_BLOCK: TimeBlock = { startTime: '00:00', endTime: '23:59', reason: 'manual' };

export async function addManualDayBlock(uid: string, dateStr: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'blockedSlots', dateStr),
    { blocks: arrayUnion(MANUAL_DAY_BLOCK) },
    { merge: true },
  );
}

export async function removeManualDayBlock(uid: string, dateStr: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'blockedSlots', dateStr),
    { blocks: arrayRemove(MANUAL_DAY_BLOCK) },
    { merge: true },
  );
}

// True if `time` on `dateStr` is not covered (within the buffer) by any of the
// provider's existing blockedSlots. Single source of truth for "is this slot free
// right now" — used by SlotPickerModal to filter displayed chips, and by
// acceptReschedule (rescheduleActions.ts) to re-verify a provider-proposed slot
// hasn't been taken by someone else between proposal and customer approval.
export async function isSlotAvailable(uid: string, dateStr: string, time: string): Promise<boolean> {
  const blocks = await getBlockedSlots(uid, dateStr);
  return !isSlotBlocked(time, blocks);
}

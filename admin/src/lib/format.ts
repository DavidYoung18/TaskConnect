const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMoney(amount: number): string {
  return `${amount.toLocaleString('en-US')} UZS`;
}

// dateStr: "YYYY-MM-DD", timeStr (optional): "HH:MM"
export function formatDate(dateStr: string, timeStr?: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return dateStr;
  const datePart = `${MONTH_ABBR[mo - 1]} ${d}, ${y}`;
  if (!timeStr) return datePart;

  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${datePart} · ${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

// Handles Firestore Timestamp objects (with .toDate()) as well as ISO strings.
export function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  const date: Date =
    typeof ts === 'object' && ts !== null && typeof (ts as { toDate?: unknown }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as string | number);

  const datePart = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${datePart} · ${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

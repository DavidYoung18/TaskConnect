// Locale-aware date/time formatting shared across booking screens.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local convention in these languages is 24-hour time with no AM/PM, regardless of
// the device's region settings — every other supported language keeps 12-hour AM/PM.
const HOUR24_LANGUAGES = new Set(['ru', 'uz']);

export function formatTime(time: string, language: string): string {
  const [h, m] = time.split(':').map(Number);
  const mins = m.toString().padStart(2, '0');
  if (HOUR24_LANGUAGES.has(language)) {
    return `${h.toString().padStart(2, '0')}:${mins}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${mins} ${period}`;
}

export function formatMonthDay(date: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  }
}

export function formatMonthDayYear(date: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  } catch {
    return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

export function formatWeekdayMonthDay(date: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return `${DAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  }
}

// Parses a "YYYY-MM-DD" string as a LOCAL date (not UTC) — avoids the one-day shift
// that `new Date(dateStr)` causes in positive-UTC-offset timezones like Tashkent (UTC+5).
export function parseLocalDate(dateStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

// Same local-timezone rationale as parseLocalDate, extended with an "HH:MM" time —
// used to compare a booking's scheduled start against the current moment.
export function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const date = parseLocalDate(dateStr);
  const [h, m] = timeStr.split(':').map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}

// Shared "time ago" formatter — used by both the chat list's message timestamps and the
// provider profile's review dates, so the two don't drift into separately-maintained logic.
export function formatRelativeTime(date: Date, language: string, t: (key: string, opts?: any) => string): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('common.justNow');
  if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) {
    try {
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-diffDays, 'day');
    } catch {
      return t('common.daysAgo', { count: diffDays });
    }
  }
  if (diffDays < 30) {
    try {
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-Math.floor(diffDays / 7), 'week');
    } catch {
      return t('common.weeksAgo', { count: Math.floor(diffDays / 7) });
    }
  }
  if (diffDays < 365) return formatMonthDay(date, language);
  return formatMonthDayYear(date, language);
}

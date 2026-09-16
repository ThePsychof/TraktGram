export function parseWatchTimeInput(input: string): Date | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const timeMatch = raw.match(timeRegex);
  let hours = 12;
  let minutes = 0;
  if (timeMatch && /\d/.test(timeMatch[0])) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }

  const setTime = (d: Date): Date => {
    const copy = new Date(d);
    copy.setUTCHours(hours, minutes, 0, 0);
    return copy;
  };

  if (raw.includes('yesterday')) return setTime(new Date(today.getTime() - ONE_DAY));
  if (raw === 'today' || raw.startsWith('today ')) return setTime(today);
  if (raw.includes('last week')) return setTime(new Date(today.getTime() - 7 * ONE_DAY));

  const daysAgoMatch = raw.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1], 10);
    return setTime(new Date(today.getTime() - n * ONE_DAY));
  }

  const dateOnly = raw.replace(timeRegex, '').trim();
  if (dateOnly) {
    const ts = Date.parse(dateOnly);
    if (!Number.isNaN(ts)) {
      const d = new Date(ts);
      if (timeMatch && /\d/.test(timeMatch[0])) return setTime(d);
      return d;
    }
  }

  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return new Date(ts);

  return null;
}
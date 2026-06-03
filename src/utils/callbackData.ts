// Compact callback data encoder/decoder for Telegram callback_data

export function encodeCallback(action: string, params: Record<string, string | number | undefined> = {}): string {
  const parts = [`a:${action}`];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    parts.push(`${k}:${String(v)}`);
  }
  // Keep within Telegram's 64-byte callback_data limit where possible
  return parts.join('|').slice(0, 64);
}

export function decodeCallback(data: string): { action: string; params: Record<string, string> } {
  const parts = data.split('|');
  const params: Record<string, string> = {};
  let action = '';
  for (const p of parts) {
    const [k, ...rest] = p.split(':');
    const v = rest.join(':');
    if (k === 'a') action = v;
    else if (k) params[k] = decodeURIComponent(v);
  }
  return { action, params };
}

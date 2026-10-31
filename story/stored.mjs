import { WHAT, failureText } from './failure.mjs';

export const unreadableLine = lang => failureText(WHAT.record, 'unreadable', lang);

export const isUnreadable = status => status === 'corrupt' || status === 'unsupported';

export function readStored(raw, { v = 1, shape = () => true } = {}) {
  if (raw === undefined || raw === null || raw === '') return { status: 'none', value: null };
  if (typeof raw !== 'string') return { status: 'corrupt', value: null };
  let value;
  try { value = JSON.parse(raw); } catch { return { status: 'corrupt', value: null }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'corrupt', value: null };
  if (value.v !== v) return { status: 'unsupported', value: null };
  return shape(value) ? { status: 'ok', value } : { status: 'corrupt', value: null };
}

// Whether the value is a plain object (for shape checks)
export const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);

const ENTRY_ID = 'asset-maid:chat-data';
const ENTRY_COMMENT = '__ASSET_MAID_CHAT_DATA__';
const DIRECTIVE = '@@dont_activate';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function drawingJobs(chat) {
  const content = entryText(chat)?.trimStart() ?? '';
  if (!content.startsWith(DIRECTIVE)) return null;
  let data;
  try { data = JSON.parse(content.slice(DIRECTIVE.length).trim()); } catch { return null; }
  if (!isObject(data) || !isObject(data.jobs)) return null;
  const ids = Object.keys(data.jobs).sort();
  return ids.length ? JSON.stringify(ids) : null;
}

export function entryText(chat) {
  const lore = Array.isArray(chat?.localLore) ? chat.localLore : [];
  const entries = lore.filter(e => isObject(e) && (e.id === ENTRY_ID || e.comment === ENTRY_COMMENT));
  return entries.length === 1 && typeof entries[0].content === 'string' ? entries[0].content : null;
}

const PICTURE_RE = new RegExp([
  /<div\b[^>]*\bclass="am-illustration-(?:projection|history-bank)"[^>]*>[\s\S]*?<\/div>/.source,
  /<span\b[^>]*\bclass="am-image"[^>]*>\s*<img\b[^>]*>\s*<\/span>/.source,
].join('|'), 'g');

export const withoutPictures = text => String(text ?? '').replace(PICTURE_RE, '');

import { findTags, messageId, TAG_RE, MARK_RE } from './blocks.mjs';
import { entryText, withoutPictures } from './asset-maid.mjs';
import { RESULT_LINE_RE } from './prompts.mjs';

// Our result line right before its tag, our result tags and our marks
const OURS_RE = new RegExp(String.raw`${RESULT_LINE_RE.source}(?=\s*${TAG_RE.source})|${TAG_RE.source}|${MARK_RE.source}`, 'g');

const plainText = text => withoutPictures(text).replace(OURS_RE, '').replace(/\s+/g, ' ').trim();

const resultShape = chat => JSON.stringify((chat?.message ?? []).map((m, i) => [messageId(m, i), plainText(m?.data)]));

export const resultMark = (chat, tag) => ({ tag, shape: resultShape(chat), entry: entryText(chat) });

const hasTag = (chat, tag) => (chat?.message ?? []).some(m => findTags(m?.data ?? '').some(t => t.key === tag));

export const chatMovedOn = (mark, chat) => !!mark && !!chat && hasTag(chat, mark.tag) && resultShape(chat) !== mark.shape;

export const markNow = (mark, chat) => (mark && chat && hasTag(chat, mark.tag) && entryText(chat) !== mark.entry ? { ...mark, entry: entryText(chat) } : mark);

export function resultTakenBack(mark, chat) {
  if (!mark || !chat) return false;
  if (hasTag(chat, mark.tag)) return false; // the result is there
  if (entryText(chat) === mark.entry) return false; // Asset Maid did not write since
  return resultShape(chat) === mark.shape;
}

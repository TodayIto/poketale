import { GUIDE_AT, GUIDE_HEAD, GUIDE_CORE, GUIDE_SUMMARY, GUIDE_ENDED, GUIDE_ONGOING, GUIDE_AMOUNT } from './guide-prompts.mjs';

const FORMS = ['summary', 'key', 'log'];

export function guideLines(info) {
  if (!FORMS.includes(info?.form)) return null;
  const count = info.turns ? info.turns[1] - info.turns[0] + 1 : 0;
  const amount = count > 0 ? [GUIDE_AMOUNT.find(tier => count <= tier.upTo).text] : [];
  const base = info.form === 'summary' ? GUIDE_SUMMARY : [...GUIDE_CORE, ...amount];
  return [...base, ...(info.result ? GUIDE_ENDED : GUIDE_ONGOING)];
}

// The OOC text (tag stripped) with its guide placed (GUIDE_AT). Unchanged when there is no guide
export function withGuide(ooc, info) {
  const lines = guideLines(info);
  if (!lines) return ooc;
  const guide = [GUIDE_HEAD, ...lines.map(line => `- ${line}`)].join('\n');
  if (GUIDE_AT === 'before') return `(OOC: ${guide})\n${ooc}`;
  if (GUIDE_AT === 'after') return `${ooc}\n(OOC: ${guide})`;
  return ooc.endsWith(')') ? `${ooc.slice(0, -1)}\n${guide})` : `${ooc}\n${guide}`;
}

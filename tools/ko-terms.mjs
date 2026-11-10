// Shared Korean wording for extracted text tables.
export const KO_TERMS = Object.freeze([

  ['지닌 도구를', '지닌 물건을'], ['지닌 도구가', '지닌 물건이'], ['지닌 도구는', '지닌 물건은'], ['지닌 도구와', '지닌 물건과'],
  ['지닌 도구로', '지닌 물건으로'], ['지닌 도구랑', '지닌 물건이랑'], ['지닌 도구', '지닌 물건'],

  ['아니오', '아니요'],
]);

export const koTerm = (lang, text) => (lang === 'ko' ? KO_TERMS.reduce((out, [from, to]) => out.replaceAll(from, to), text) : text);

export function withKoTerms(lang, table) {
  const replaced = [];
  const out = Object.fromEntries(Object.entries(table).map(([key, value]) => {
    if (key === '_source' || typeof value !== 'string') return [key, value];
    const next = koTerm(lang, value);
    if (next !== value) replaced.push(key);
    return [key, next];
  }));
  return { table: out, replaced };
}

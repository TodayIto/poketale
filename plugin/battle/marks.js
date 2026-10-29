export function mark(name) { globalThis.performance?.mark?.(name); }

export function clearBattleMarks() {
  const perf = globalThis.performance;
  if (!perf?.getEntriesByType) return;
  for (const [type, clear] of [['mark', 'clearMarks'], ['measure', 'clearMeasures']]) {
    const stale = new Set(perf.getEntriesByType(type).map(entry => entry.name).filter(name => name.startsWith('pb:') && name !== 'pb:script'));
    for (const name of stale) perf[clear](name);
  }
}

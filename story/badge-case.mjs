import { BADGES, earnedBadges, withBadge, recordOf, badgePicture, isTrial, isChampion, inLang, badgeById, badgeCount, shownRegions, PRE_STORY } from './badges.mjs';
import { say } from './screen-text.mjs';

const fromBot = state => !!state?.league;

export function badgeCaseModel(state, lang, { gym = null, debug = false, locked = false, icon, monLabel }) {
  const earned = new Set(earnedBadges(state));
  const pic = badge => {
    const where = badgePicture(badge);
    return where.item ? { icon: icon(where.item) } : where;
  };
  const row = badge => ({ id: badge.id, name: inLang(badge.name, lang), earned: earned.has(badge.id), champion: isChampion(badge), pic: pic(badge) });
  const regions = shownRegions(state?.league?.era ?? null).map(region => {
    const rows = BADGES.filter(badge => badge.region === region.id).map(row);
    const badges = rows.filter(r => !r.champion);
    return { id: region.id, name: inLang(region.name, lang), count: badges.filter(r => r.earned).length, total: badges.length, rows };
  });
  const badge = gym && badgeById(gym.id);
  let open = null;
  if (badge) {
    const record = recordOf(state, badge.id);
    const kind = isChampion(badge) ? 'champion' : badge.kind === 'grand' ? 'kahuna' : isTrial(badge) ? 'trial' : 'gym';
    const [prev, next] = neighbours(badge);
    open = { ...row(badge), kind, prev, next, leader: badge.leaders.map(pair => inLang(pair, lang)).join(' · '), place: badge.place ? inLang(badge.place, lang) : '',
      queen: !!badge.queen, date: record?.date === PRE_STORY ? say(lang, 'badge.preStory') : record?.date ?? null,
      party: record?.party?.length ? record.party.map(monLabel).join(' · ') : null, shine: gym.shine ?? 0,
      grant: debug && !fromBot(state) ? { earned: earned.has(badge.id), off: locked } : null };
  }
  return { count: badgeCount(state), total: regions.reduce((sum, region) => sum + region.total, 0), regions, open };
}

function neighbours(badge) {
  const rows = BADGES.filter(b => b.region === badge.region), at = rows.findIndex(b => b.id === badge.id);
  return [rows[at - 1]?.id ?? null, rows[at + 1]?.id ?? null];
}

export function badgePress(ui, hit, { state, lang, debug = false, locked = false }) {
  const same = { ui, effect: null };
  const open = ui.gym && badgeById(ui.gym.id);
  switch (hit.t) {
    case 'gym': return badgeById(hit.id) ? { ui: { ...ui, gym: { id: hit.id, shine: 0 } }, effect: null } : same;
    case 'gymClose': return { ui: { ...ui, gym: null }, effect: null };
    case 'gymNav': {
      const to = open && neighbours(open)[hit.d < 0 ? 0 : 1];
      return to ? { ui: { ...ui, gym: { id: to, shine: 0 } }, effect: null } : same;
    }
    case 'gymShine':
      return open && earnedBadges(state).includes(open.id) ? { ui: { ...ui, gym: { ...ui.gym, shine: (ui.gym.shine ?? 0) + 1 } }, effect: null } : same;
    case 'gymGrant': {
      if (!debug || fromBot(state) || locked || !open) return same;
      const earned = !earnedBadges(state).includes(open.id);
      const name = inLang(open.name, lang);
      return { ui, effect: { kind: 'debugBadges', badges: withBadge(state, open.id, earned), after: say(lang, earned ? 'badge.given' : 'badge.taken', { badge: name }) } };
    }
    default: return same;
  }
}

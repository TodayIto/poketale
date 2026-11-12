// Image transport order for the selected route.
export const PICTURE_ROUTES = Object.freeze(['auto', 'direct', 'risu']);
export const DEFAULT_PICTURE_ROUTE = 'auto';

export const SHOWDOWN_HOST = 'play.pokemonshowdown.com';
const WAYS = Object.freeze({
  auto: Object.freeze(['direct', 'host']),
  direct: Object.freeze(['direct']),
  risu: Object.freeze(['host', 'direct']),
  risuPage: Object.freeze(['host']),
  hostOnly: Object.freeze(['host']),
  here: Object.freeze(['direct']),
});

export function pictureWays(route, url, { read = true, page = false } = {}) {
  if (!/^https?:/i.test(url)) return WAYS.here;
  if (read && new URL(url).host === SHOWDOWN_HOST) return WAYS.hostOnly;
  const id = PICTURE_ROUTES.includes(route) ? route : DEFAULT_PICTURE_ROUTE;
  return id === 'risu' && page ? WAYS.risuPage : WAYS[id];
}

export const viewPictureWays = route => url => pictureWays(route, url);

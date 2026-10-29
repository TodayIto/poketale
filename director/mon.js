import { parseHealth } from './parse.js';
import { displayName } from '../engine/mon.mjs';

export function monView(battle, names, ident, details, health, previousMaxhp) {
  const [speciesName, ...rest] = details.split(', ');
  const species = battle.dex.species.get(speciesName);
  const nickname = ident.slice(ident.indexOf(':') + 1).trim();
  return {
    speciesId: species.id, spriteId: species.spriteid,

    name: displayName(battle.dex, names, species.name, nickname),
    level: Number(rest.find(s => /^L\d+$/.test(s))?.slice(1) || 100),
    gender: rest.includes('M') ? 'M' : rest.includes('F') ? 'F' : '',
    shiny: rest.includes('shiny'), ...parseHealth(health, previousMaxhp),

    ...(rest.some(s => s.startsWith('tera:')) ? { tera: rest.find(s => s.startsWith('tera:')).slice(5) } : {}),
  };
}

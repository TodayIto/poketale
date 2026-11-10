export const norm = s => String(s ?? '').normalize('NFKC').replace(/♀/g, 'f').replace(/♂/g, 'm').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

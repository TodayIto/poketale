const NAVY = '#23435f';

export const RING_ARC = 2 * Math.PI * 16;
export const RING_COLOR = Object.freeze({ enjoy: '#e0719a', full: '#e39a2d', energy: '#4fb848' });

export const RING_ICON = Object.freeze({
  enjoy: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#fff" d="M7 2h2v9.3A2.6 2.6 0 1 1 7 8.9z"/><path d="M8.6 2.4c2.4.5 4 1.7 4 4" fill="none" stroke="#fff" stroke-width="1.9"/></svg>',
  full: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#fff" d="M1.5 7.5h13a6.5 5.6 0 0 1-13 0z"/><path d="M5.5 1.5v3M8 1v3.5M10.5 1.5v3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
  energy: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#fff" d="M9.6 1 3.4 9.2h4.1L6.4 15l6.2-8.4H8.4z"/></svg>',
});

export const ringDash = share => `${(Math.max(0, Math.min(1, share)) * RING_ARC).toFixed(1)} ${RING_ARC.toFixed(1)}`;

export const ringSvg = (kind, share) => `<svg viewBox="0 0 48 48" aria-hidden="true">`
  + `<circle cx="24" cy="24" r="21" fill="#fff" stroke="${NAVY}" stroke-width="2.5"/><circle cx="24" cy="24" r="16" fill="none" stroke="#d6dee5" stroke-width="6"/>`
  + `<circle class="arc" cx="24" cy="24" r="16" fill="none" stroke="${RING_COLOR[kind]}" stroke-width="6" stroke-dasharray="${ringDash(share)}" transform="rotate(-90 24 24)"/></svg>`;

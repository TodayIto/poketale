export const UI_VARS = '--navy:#315a77; --navy-dark:#23435f; --red:#d8434d; --red-dark:#8e2835; --ink:#1d3347;'
  + ' --paper:linear-gradient(135deg,#ffffff 0%,#f3f8fc 55%,#e2eef7 100%); --red-fill:linear-gradient(to bottom,#ec5a64,#d8434d);';

// Border, shadow and background of card-style windows (size and overflow set per use)
export const CARD_FRAME = 'border:2.5px solid var(--navy); border-radius:12px; box-shadow:0 4px 0 var(--navy-dark); background:var(--paper);';

export const BAND_CSS = `
  .poke-battle .band { flex:none; height:var(--band); display:flex; align-items:center; gap:8px; padding:0 2px; }
  .poke-battle .band .grow { flex:1; }
  .poke-battle .band button { flex:none; width:28px; height:26px; padding:0; display:flex; align-items:center; justify-content:center;
    border:2px solid var(--navy); border-radius:7px; background:#fff; color:var(--navy); box-shadow:0 2.5px 0 var(--navy-dark); cursor:pointer; }
  .poke-battle .band button:active:not(:disabled) { transform:translateY(2px); box-shadow:0 .5px 0 var(--navy-dark); }
  .poke-battle .band button:disabled { opacity:.4; cursor:default; }
  .poke-battle .band button:focus-visible { outline:2px solid #ffd35c; outline-offset:2px; }
  .poke-battle .band button[hidden] { display:none; }
  .poke-battle .band button svg { width:16px; height:16px; display:block; }
  .poke-battle .band .leave { color:var(--red); }
  .poke-battle .band .leave svg { width:13px; height:13px; }`;

export const rowButtonsCss = row => `
  ${row} { display:flex; gap:8px; margin-top:12px; }
  ${row} button { flex:1; font:inherit; font-weight:700; padding:7px 10px; border:2px solid var(--red-dark); border-radius:9px;
    background:var(--red-fill); color:#fff; box-shadow:0 3px 0 var(--red-dark); cursor:pointer; text-shadow:0 1px 0 #0004; }
  ${row} button.sec { border-color:var(--navy); background:#fff; color:var(--navy); box-shadow:0 3px 0 var(--navy-dark); text-shadow:none; }`;

export const crossIcon = (width = 2.6) =>
  `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="${width}" stroke-linecap="round"/></svg>`;

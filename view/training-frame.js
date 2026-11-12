import { TAP, esc, partsCss, gaugeRingCss, ringHtml, drawRing, fabHtml, exitsHtml, stepperHtml, drawStepper } from './frame-parts.js';
import { exitTop, fabBox } from './amie-layout.js';
import { ICON } from './amie-frame.js';
import { artSvg } from './amie-art.js';
import { badgeCss, bindBadge } from './reply-notice.js';

export const sackSvg = (color, mark = null) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8v3.4" stroke="#23435f" stroke-width="2"/>'
  + `<rect x="6.2" y="4" width="11.6" height="18.6" rx="5" fill="${color}" stroke="#23435f" stroke-width="2"/>`
  + '<rect x="6.6" y="9.4" width="10.8" height="3" fill="#0003"/><rect x="8.4" y="6" width="2" height="13" rx="1" fill="#fff6"/>'
  + (mark ? artSvg(mark).replace('<svg ', '<svg x="7.5" y="10" width="9" height="9" ') : '') + '</svg>';

function css(f) {
  return `
  ${partsCss('.pkb-train')}
  .pkb-train{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;font-size:13px;line-height:1.35;}
  .pkb-train .exit{top:${exitTop(f)}px;} .pkb-train .exit.back{left:${f.side}px;} .pkb-train .exit.close{right:${f.side}px;}
  ${gaugeRingCss('.pkb-train', f.ring)}
  .pkb-train .ring.energy{position:absolute;left:${f.side + TAP + f.gap}px;top:${f.top}px;}
  .pkb-train .fab.bags{right:${fabBox(f.train).side}px;bottom:${f.train.bottom}px;--d:${f.train.d}px;}
  .pkb-train .shade{position:absolute;inset:0;pointer-events:auto;background:rgba(15,24,34,.35);}
  .pkb-train .picker{position:absolute;left:50%;top:${exitTop(f) + TAP + 10}px;transform:translateX(-50%);width:min(560px, calc(100% - ${2 * f.side}px));
    max-height:calc(100% - ${exitTop(f) + TAP + 20}px);overflow:auto;display:flex;flex-direction:column;gap:10px;}
  .pkb-train .picker .hd{margin:0;font-size:15px;}
  .pkb-train .picker .warn{margin:-4px 0 0;color:#c8401c;font-size:12px;}
  .pkb-train .picker .about{display:flex;flex-direction:column;gap:6px;}
  .pkb-train .picker .about:empty{display:none;}
  .pkb-train .picker .bag{display:flex;align-items:center;gap:9px;padding:6px 10px;border:2px solid #c9d6e0;border-radius:10px;background:#f7fafc;}
  .pkb-train .picker .bag svg{flex:none;width:34px;height:34px;}
  .pkb-train .picker .bag .k{margin:0;}
  .pkb-train .picker .bag b{display:block;font-weight:400;font-size:14px;}
  .pkb-train .picker .bag p{margin:2px 0 0;font-size:12px;color:#3b5568;}
  .pkb-train .picker .k{font-size:12px;color:#5d7486;margin-bottom:4px;}
  .pkb-train .picker .grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
  @media (min-width:641px){ .pkb-train .picker .grid{grid-template-columns:1fr 1fr 1fr;} }
  .pkb-train .picker .stat{display:flex;align-items:center;gap:9px;min-height:56px;padding:6px 10px;border:2.5px solid #2b4a68;border-radius:10px;background:#fff;
    box-shadow:0 3px 0 #1a3247;font-size:14px;text-align:left;}
  .pkb-train .picker .stat svg{flex:none;width:34px;height:34px;}
  .pkb-train .picker .stat:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #1a3247;}
  .pkb-train .picker .stat:disabled{opacity:.45;cursor:default;}
  .pkb-train .picker .reset{display:flex;align-items:center;gap:9px;min-height:46px;padding:6px 10px;border:2px dashed #9aaab7;border-radius:10px;background:#eef3f7;
    color:#5d7486;font-size:13px;text-align:left;}
  ${badgeCss('.pkb-train')}
  .pkb-train .picker .reset svg{flex:none;width:26px;height:26px;}
  .pkb-train .picker .reset:disabled{opacity:.45;cursor:default;}
`;
}

export function mountTrainingFrame(stage, { f, words, stats, sizes, size, resetId, colors, select = () => {}, notice = null, on }) {
  const doc = stage.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'pkb-train';
  let picked = sizes.includes(size) ? size : sizes[0], blocked = () => false, replaced = null, about = [];
  root.innerHTML = `<style>${css(f)}</style>`
    + exitsHtml(words) + ringHtml('energy', words.energy) + fabHtml('bags', words.bags, ICON.train)
    + '<div class="shade" hidden></div>'
    + `<div class="picker sheet" role="dialog" aria-label="${esc(words.pick)}" hidden><p class="hd">${esc(words.pick)}</p><div class="about"></div><p class="warn" hidden></p>`
    + `<div><div class="k">${esc(words.sizeTitle)}</div>${stepperHtml(words.sizeTitle, { prev: words.prevPage, next: words.nextPage })}</div>`
    + `<div class="grid">${stats.map(stat => `<button type="button" class="stat" data-stat="${stat}">${sackSvg(colors[stat])}<span>${esc(words.stat[stat])}</span></button>`).join('')}</div>`
    + `<button type="button" class="reset">${sackSvg(colors.reset)}<span>${esc(words.bag[resetId])} · ${esc(words.resetNote)}</span></button>`
    + '</div>';
  stage.append(root);
  const $ = selector => root.querySelector(selector);
  const picker = $('.picker'), shade = $('.shade'), stepper = $('.stepper');

  const draw = () => {
    const at = sizes.indexOf(picked);
    drawStepper(stepper, { at, count: sizes.length, main: picked.toUpperCase(), small: `${words.size[picked]} · ${words.gain[picked]}` });
    for (const button of picker.querySelectorAll('.stat')) button.disabled = blocked(`${button.getAttribute('data-stat')}_${picked}`);
    $('.reset').disabled = blocked(resetId);
    const warn = $('.warn');
    warn.hidden = !replaced;
    warn.textContent = replaced ?? '';
    $('.about').innerHTML = about.map(one => `<div class="bag">${sackSvg(one.color, one.mark)}<div><p class="k">${esc(one.label)}</p><b>${esc(one.name)}</b>`
      + `<p>${esc(one.text)}</p></div></div>`).join('');
  };
  const open = on2 => {
    picker.hidden = shade.hidden = !on2;
    $('.fab.bags').classList.toggle('on', on2);
    if (on2) { on.open?.(); draw(); } else on.shut?.();
  };
  const press = (element, act) => element.addEventListener('click', () => { select(); act(); });
  press($('.exit.back'), () => on.back());
  press($('.exit.close'), () => on.close());
  press($('.fab.bags'), () => open(picker.hidden));
  shade.addEventListener('click', () => open(false));
  press($('.stepper .round.l'), () => { picked = sizes[Math.max(0, sizes.indexOf(picked) - 1)]; on.size?.(picked); draw(); });
  press($('.stepper .round.r'), () => { picked = sizes[Math.min(sizes.length - 1, sizes.indexOf(picked) + 1)]; on.size?.(picked); draw(); });
  for (const button of picker.querySelectorAll('.stat')) press(button, () => { open(false); on.bag(`${button.getAttribute('data-stat')}_${picked}`); });
  press($('.reset'), () => { open(false); on.bag(resetId); });
  const unbadge = bindBadge(root, { notice, arrived: words.arrived });

  return {
    root,
    get pickerOpen() { return !picker.hidden; },

    energy(share) { drawRing($('.ring.energy'), share); },

    bagsAt() {
      const box = $('.fab.bags .o').getBoundingClientRect(), at = root.getBoundingClientRect();
      return { x: box.left + box.width / 2 - at.left, y: box.top + box.height / 2 - at.top };
    },

    back() {
      if (picker.hidden) return false;
      open(false);
      return true;
    },

    state(next) {
      blocked = next.blocked ?? blocked;
      replaced = next.replaced ?? null;
      about = next.about ?? [];
      if (!picker.hidden) draw();
    },
    remove() { unbadge(); root.remove(); },
  };
}

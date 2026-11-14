import { DOT } from './amie-scenes.js';

const attrsOf = text => Object.fromEntries([...String(text).matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const styleOf = text => Object.fromEntries(String(text ?? '').split(';').map(s => s.split(':')).filter(p => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join(':').trim()]));

export function readAnimation(text) {
  const parts = String(text).trim().split(/\s+/), times = parts.filter(p => /^-?[\d.]+s$/.test(p)).map(parseFloat);
  return { name: parts[0], dur: times[0] || 1, delay: times[1] || 0, steps: Number(/steps\((\d+)\)/.exec(text)?.[1] ?? 0), alternate: parts.includes('alternate') };
}

export function parseSvg(svg) {
  const text = String(svg).replace(/<style>[\s\S]*?<\/style>/g, '');
  const head = attrsOf(/<svg\b([^>]*)>/.exec(text)?.[1] ?? '');
  const [x, y, w, h] = (head.viewBox ?? '0 0 0 0').split(/[\s,]+/).map(Number);
  const root = { tag: 'g', kids: [] }, stack = [root];
  for (const m of text.matchAll(/<(\/?)(svg|g|path)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, self] = m, top = stack.at(-1);
    if (tag === 'svg') continue;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const a = attrsOf(rest);
    if (tag === 'path') { if (a.d) top.kids.push({ tag: 'path', fill: a.fill ?? '#000000', opacity: a['fill-opacity'] !== undefined ? Number(a['fill-opacity']) : 1, d: a.d }); continue; }
    const st = styleOf(a.style), t = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(a.transform ?? '');
    const node = { tag: 'g', layer: a['data-layer'] ?? null, tx: t ? Number(t[1]) : 0, ty: t ? Number(t[2]) : 0, opacity: st.opacity !== undefined ? Number(st.opacity) : 1,
      anim: st.animation ? readAnimation(st.animation) : null, vars: { dx: parseFloat(st['--dx']) || 0, a: parseFloat(st['--a']) || 0, b: parseFloat(st['--b']) || 0 }, kids: [] };
    top.kids.push(node);
    if (!self) stack.push(node);
  }
  const layers = [];
  for (const kid of root.kids) {
    if (kid.tag === 'g' && kid.layer) layers.push({ name: kid.layer, kids: kid.kids });
    else if (layers.at(-1)?.name === '') layers.at(-1).kids.push(kid);
    else layers.push({ name: '', kids: [kid] });
  }
  return { box: { x, y, w, h }, size: { w: Number(head.width) || w / DOT, h: Number(head.height) || h / DOT }, layers };
}

export function pathBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0, box = null;
  const see = () => { box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y }; };
  for (const [, cmd, args] of String(d).matchAll(/([MmHhVvZzLl])([^MmHhVvZzLl]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    switch (cmd) {
      case 'M': case 'L': for (let i = 0; i + 1 < n.length; i += 2) { x = n[i]; y = n[i + 1]; if (i === 0 && cmd === 'M') { sx = x; sy = y; } see(); } break;
      case 'm': case 'l': for (let i = 0; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; if (i === 0 && cmd === 'm') { sx = x; sy = y; } see(); } break;
      case 'H': for (const v of n) { x = v; see(); } break;
      case 'h': for (const v of n) { x += v; see(); } break;
      case 'V': for (const v of n) { y = v; see(); } break;
      case 'v': for (const v of n) { y += v; see(); } break;
      default: x = sx; y = sy; break;
    }
  }
  return box;
}

function nodesBox(nodes, tx = 0, ty = 0) {
  let box = null;
  const add = b => { if (b) box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b; };
  for (const n of nodes) {
    if (n.tag === 'path') { const b = pathBox(n.d); add(b && { x0: b.x0 + tx, y0: b.y0 + ty, x1: b.x1 + tx, y1: b.y1 + ty }); } else add(nodesBox(n.kids, tx + n.tx, ty + n.ty));
  }
  return box;
}
const moves = node => node.tag === 'g' && (!!node.anim || node.kids.some(moves));

export function scenePieces(parsed, { front = [] } = {}) {
  const out = [], view = parsed.box;
  let still = null;
  const flush = () => { if (still?.nodes.length) out.push(still); still = null; };
  const walk = (nodes, layer, isFront, chain, tx, ty, alpha) => {
    for (const n of nodes) {
      if (moves(n) && (n.anim || n.kids.some(moves))) {
        if (n.anim) {
          flush();
          const motion = [...chain, { ...n.anim, vars: n.vars, base: n.opacity }];

          const own = n.kids.filter(k => !moves(k)), deeper = n.kids.filter(moves);
          if (own.length) out.push({ layer, front: isFront, motion, nodes: own, tx: tx + n.tx, ty: ty + n.ty, alpha });
          walk(deeper, layer, isFront, motion, tx + n.tx, ty + n.ty, alpha);
        } else walk(n.kids, layer, isFront, chain, tx + n.tx, ty + n.ty, alpha * n.opacity);
        continue;
      }

      if (chain.length) { out.push({ layer, front: isFront, motion: chain, nodes: [n], tx, ty, alpha }); continue; }
      if (!still || still.front !== isFront || still.tx !== tx || still.ty !== ty || still.alpha !== alpha) { flush(); still = { layer, front: isFront, motion: [], nodes: [], tx, ty, alpha }; }
      still.nodes.push(n);
    }
  };
  for (const layer of parsed.layers) walk(layer.kids, layer.name, front.includes(layer.name), [], 0, 0, 1);
  flush();

  const pieces = [];
  for (const p of out) {
    const last = pieces.at(-1);
    if (last && last.motion.length && last.motion === p.motion && last.tx === p.tx && last.ty === p.ty) { last.nodes.push(...p.nodes); continue; }
    pieces.push({ ...p, nodes: [...p.nodes] });
  }
  return pieces.flatMap(p => {
    let b = nodesBox(p.nodes, p.tx, p.ty);
    if (!b) return [];
    if (!p.motion.length) b = { x0: Math.max(b.x0, view.x), y0: Math.max(b.y0, view.y), x1: Math.min(b.x1, view.x + view.w), y1: Math.min(b.y1, view.y + view.h) };
    if (b.x1 <= b.x0 || b.y1 <= b.y0) return [];
    const x = Math.floor(b.x0 / DOT) * DOT, y = Math.floor(b.y0 / DOT) * DOT, w = Math.ceil((b.x1 - x) / DOT) * DOT, h = Math.ceil((b.y1 - y) / DOT) * DOT;
    return [{ ...p, x, y, w, h, px: { w: w / DOT, h: h / DOT } }];
  });
}

const KEYFRAMES = {
  pkbX: (p, a) => ({ x: a.vars.dx * p }),
  pkbS: (p, a) => ({ x: a.vars.dx * p }),
  pkbY: (p, a) => ({ y: a.vars.a + (a.vars.b - a.vars.a) * p }),

  pkbA: (p, a, raw) => ({ alpha: raw < 0.5 ? a.base : 0 }),
  pkbB: (p, a, raw) => ({ alpha: raw < 0.5 ? 0 : 1 }),
  pkbT: (p, a, raw) => ({ alpha: raw < 0.5 ? a.base : 0.35 }),
  pkbF: p => ({ alpha: 0.3 + 0.55 * p }),
};
export const KNOWN_MOTIONS = Object.freeze(Object.keys(KEYFRAMES));

export function motionAt(chain, t) {
  let x = 0, y = 0, alpha = 1;
  for (const a of chain) {
    const k = KEYFRAMES[a.name];
    if (!k) { alpha *= a.base; continue; }
    const run = (t - a.delay) / a.dur, n = Math.floor(run);
    let raw = run - n;
    if (a.alternate && ((n % 2) + 2) % 2 === 1) raw = 1 - raw;
    const p = a.steps ? Math.floor(raw * a.steps) / a.steps : raw;
    const v = k(p, a, raw);
    x += v.x ?? 0; y += v.y ?? 0; alpha *= v.alpha ?? 1;
  }
  return { x, y, alpha };
}

export function drawNodes(ctx, nodes, alpha = 1, Path = globalThis.Path2D) {
  for (const n of nodes) {
    if (n.tag === 'path') {
      ctx.globalAlpha = alpha * n.opacity;
      ctx.fillStyle = n.fill;
      ctx.fill(new Path(n.d));
      continue;
    }
    if (n.tx || n.ty) { ctx.save(); ctx.translate(n.tx, n.ty); drawNodes(ctx, n.kids, alpha * n.opacity, Path); ctx.restore(); } else drawNodes(ctx, n.kids, alpha * n.opacity, Path);
  }
  ctx.globalAlpha = 1;
}

export function paintSvg(ctx, svg, { k = 1 / DOT, x = 0, y = 0 } = {}) {
  const parsed = parseSvg(svg);
  ctx.save();
  ctx.setTransform(k, 0, 0, k, x - parsed.box.x * k, y - parsed.box.y * k);
  ctx.imageSmoothingEnabled = false;
  drawNodes(ctx, parsed.layers.flatMap(l => l.kids));
  ctx.restore();
}

let seq = 0;

function bake(scene, prefix, piece) {
  const key = `${prefix}-${++seq}`;
  const canvas = scene.textures.createCanvas(key, piece.px.w, piece.px.h);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1 / DOT, 0, 0, 1 / DOT, -piece.x / DOT, -piece.y / DOT);
  ctx.translate(piece.tx, piece.ty);
  drawNodes(ctx, piece.nodes);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.refresh();
  return key;
}

const clock = () => (globalThis.performance?.now() ?? Date.now()) / 1000;

export const stillPictures = () => { try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function mountScene(scene, svg, { prefix = 'pkb-scene', front = ['L5', 'L6'] } = {}) {
  const pieces = scenePieces(parseSvg(svg), { front });
  const back = scene.add.container(0, 0), fore = scene.add.container(0, 0), keys = [], movers = [];
  let bytes = 0;
  for (const p of pieces) {
    const key = bake(scene, prefix, p);
    keys.push(key);
    bytes += p.px.w * p.px.h * 4;
    const image = scene.add.image(p.x, p.y, key).setOrigin(0).setScale(DOT).setAlpha(p.alpha);
    (p.front ? fore : back).add(image);
    if (p.motion.length) movers.push({ image, p });
  }
  let gone = false;
  const handle = {
    back, front: fore, keys, bytes, pieces,
    update(t = clock()) {
      if (gone) return;
      for (const { image, p } of movers) {
        const m = motionAt(p.motion, t), x = p.x + m.x, y = p.y + m.y, alpha = p.alpha * m.alpha;
        if (image.x !== x || image.y !== y) image.setPosition(x, y);
        if (image.alpha !== alpha) image.setAlpha(alpha);
      }
    },
    setVisible(on) { if (!gone) { back.setVisible(on); fore.setVisible(on); } },
    destroy() {
      if (gone) return;
      gone = true;
      back.destroy(); fore.destroy();
      for (const key of keys) if (scene.textures?.exists(key)) scene.textures.remove(key);
    },
  };
  handle.update();
  return handle;
}

export function svgTexture(scene, svg, prefix = 'pkb-piece') {
  const parsed = parseSvg(svg), b = parsed.box;
  const piece = { x: b.x, y: b.y, w: b.w, h: b.h, px: { w: Math.ceil(b.w / DOT), h: Math.ceil(b.h / DOT) }, tx: 0, ty: 0, nodes: parsed.layers.flatMap(l => l.kids) };
  const key = bake(scene, prefix, piece);
  return { key, box: b, bytes: piece.px.w * piece.px.h * 4 };
}

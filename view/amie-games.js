// Adapted layouts: PlayNav src/amie/games/*.lua, revision 7f1b4dcb8ca1cc85180272c165842374924f1564.
// Copyright (c) 2026 poooooby, MIT License. See THIRD-PARTY-NOTICES.md.
// Modified for PokeTale on 2026-11-10.
import { createBerryPicker, createHeadIt, createTilePuzzle, prizesFor, starsOf, recordScore, beatsRecord, BERRY_RULES, HEAD_RULES, TILE_GRIDS } from '../story/amie-games.mjs';
import { CARD_TIMES } from './amie-tray-card.js';
import { BAND } from './amie-frame.js';
import { windowText } from './ui/text.js';
import { headItScene } from './amie-scenes.js';
import { berryScene, berryGapSvg, berryFrontGrass, tilePicture, tileFrameSvg } from './amie-scenes-games.js';
import { mountScene, svgTexture, paintSvg } from './scene-bake.js';

function monSprite(scene, asset, x, feet, tall) {
  const b = asset.bounds;
  const sprite = scene.add.sprite(x, feet, asset.key, asset.frame).setOrigin((b.left + b.right) / 2 / asset.width, b.bottom / asset.height);
  if (scene.anims.exists(asset.key)) sprite.play(asset.key);
  return sprite.setScale(Math.min(tall / (b.bottom - b.top), (tall * 1.4) / (b.right - b.left)));
}

const cue = (screen, name) => screen.sound?.play(name);

const threePlayers = players => [players[0], players[1] ?? players[0], players[2] ?? players[0]];

function gameLife(screen, layer) {
  const s = screen.scene, running = new Set(), scenes = [], keys = [];
  let over = false;
  layer.once('destroy', () => {
    over = true;
    for (const one of running) one.remove();
    running.clear();
    for (const one of scenes) one.destroy();
    for (const key of keys) if (s.textures.exists(key)) s.textures.remove(key);
  });
  const life = {

    after(ms, fn) {
      if (over) return;
      const timer = s.time.delayedCall(ms, () => { running.delete(timer); fn(); });
      running.add(timer);
    },

    wait: ms => new Promise(resolve => life.after(ms, resolve)),

    add(config) {
      if (over) return null;
      const added = s.tweens.add({ ...config, onComplete: (...args) => { running.delete(added); config.onComplete?.(...args); } });
      running.add(added);
      return added;
    },

    tween: config => new Promise(resolve => life.add({ ...config, onComplete: () => resolve() })),

    burst: (name, n, x, y, options) => screen.burst(name, n, x, y, { ...options, tweens: life }),

    scene(svg) { const one = mountScene(s, svg, { prefix: 'amie-game', front: [] }); scenes.push(one); return one; },

    texture(svg) { const one = svgTexture(s, svg, 'amie-game'); keys.push(one.key); return one; },

    tick() { for (const one of scenes) one.update(); },
  };
  return life;
}

export function playGame(screen, game, level) {
  const s = screen.scene, W = screen.W, H = screen.H, words = screen.words;
  const layer = s.add.container(0, 0);
  screen.container.add(layer);
  const life = gameLife(screen, layer);
  return new Promise(resolve => {
    let finished = false, card = null;

    const end = (value, band = null) => {
      if (finished) return;
      finished = true;
      card = { value, prizes: prizesFor(game, level, value) };
      if (!band) { showResult(); return; }
      screen.gameBar.banner(band, words[band]);
      cue(screen, band);
      life.wait(END_BANDS[band])
        .then(() => { screen.gameBar.banner(null); return life.wait(BAND.out); })
        .then(showResult);
    };
    const done = result => {
      if (screen.playing !== handler) return;
      screen.playing = null;
      screen.gameBar.stop();
      layer.destroy();
      resolve(result);
    };
    const MAKERS = { berry: berryPicker, head: headIt, tile: tilePuzzle };
    const play = MAKERS[game](s, layer, screen, level, end, life);
    const handler = {
      down: at => (card ? null : play.down(at)),
      move: at => (card ? null : play.move(at)),
      up: at => { if (!card) play.up(at); },
      frame: dt => { life.tick(); if (!card) play.frame(dt); },
      stop: () => (card ? done(card) : done(null)),

      inRound: () => !card,
    };
    screen.playing = handler;

    function showResult() {
      const { value, prizes } = card;
      const shade = s.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0).setAlpha(0);
      layer.add(shade);
      life.tween({ targets: shade, alpha: 1, duration: 250 });
      const kinds = [...new Set(prizes)], { best, record } = roundRecord(screen, game, level, value);
      cue(screen, record ? 'record' : 'result');
      const scoreText = n => words.score[game]({ n });
      screen.gameBar.result({ title: `${words.games[game]} · ${words.levels[level]}`, stars: starsOf(game, level, value), score: scoreText(recordScore(value)),
        prizes: kinds.map(id => ({ name: screen.puffName(id), count: prizes.filter(p => p === id).length, picture: screen.puffPicture(id) })),
        game, best: best == null ? null : words.best({ score: scoreText(best) }), record, picture: game === 'tile',
        onPicture: looking => life.add({ targets: shade, alpha: looking ? 0 : 1, duration: CARD_TIMES.fade }) })
        .then(choice => done({ ...card, again: choice === 'again' }));
    }
  });
}

export function roundRecord(screen, game, level, value) {
  const best = screen.recordOf?.(game, level) ?? null;
  return { best, record: best != null && beatsRecord(game, recordScore(value), best) };
}

const END_BANDS = Object.freeze({ timeUp: 1000, done: 800 });

export const BERRY_LOW_SECONDS = 5;

function hud(screen, name) {
  screen.gameBar.start(name);
  return ({ score, time, low }) => { screen.gameBar.score(score); screen.gameBar.time(time, low); };
}

async function countIn(screen, life) {
  screen.gameBar.banner('ready', screen.words.ready);
  await life.wait(900);
  screen.gameBar.banner('go', screen.words.go);
  cue(screen, 'go');
  await life.wait(500);
  screen.gameBar.banner(null);
}

function berryPicker(s, layer, screen, level, end, life) {
  const W = screen.W, H = screen.H, words = screen.words;
  const g = createBerryPicker(level);

  layer.add(life.scene(berryScene({ time: screen.time, w: W, h: H, px: screen.unit, animate: !screen.still, bleed: true })).back);
  const crownY = screen.top + H * 0.16;
  const spacing = Math.min(28, (W * 0.86) / g.kinds);
  const hang = Array.from({ length: g.kinds }, (_, i) => ({ x: W / 2 + (i - (g.kinds - 1) / 2) * spacing, y: crownY + (i % 2 ? 6 : -4) }));

  const gap = life.texture(berryGapSvg({ size: spacing < 24 ? 18 : 20 }));
  layer.add(hang.map(p => s.add.image(p.x + gap.box.x, p.y + gap.box.y, gap.key).setOrigin(0).setScale(2)));
  const onTree = hang.map((p, i) => s.add.image(p.x, p.y, `amie-berry-${i}`).setScale(1.5));
  layer.add(onTree);

  const spotX = [W * 0.5, W * 0.17, W * 0.83], feet = H - 4, tall = Math.min(48, H * 0.26);
  const players = threePlayers(screen.players);

  const slots = [0, 1, 2].map(i => {
    const sprite = monSprite(s, players[i], spotX[i], feet + tall + 20, tall);
    const bubble = s.add.container(spotX[i], feet - tall - 16).setVisible(false);
    bubble.add(s.add.graphics().fillStyle(0xffffff).lineStyle(1, 0x5a6a7a).fillEllipse(0, 0, 26, 20).strokeEllipse(0, 0, 26, 20).fillCircle(-6, 13, 3).strokeCircle(-6, 13, 3));
    bubble.want = s.add.image(0, 0, 'amie-berry-0').setScale(1.2);
    bubble.left = s.add.rectangle(-10, 9, 20, 2, 0x4f9a4a).setOrigin(0, 0.5);
    bubble.add([bubble.want, bubble.left]);
    return { i, sprite, bubble };
  });
  for (const sl of slots) layer.add(sl.sprite);

  layer.add(life.scene(grassStrip(berryFrontGrass({ time: screen.time }), W, H, !screen.still)).back);
  for (const sl of slots) layer.add(sl.bubble);
  const setHud = hud(screen, words.games.berry);
  let drag = null, live = false;
  const fx = s.add.container(0, 0);
  layer.add(fx);
  countIn(screen, life).then(() => { live = true; });
  const showHud = () => setHud({ score: words.score.berry({ n: g.score }), time: g.timer / BERRY_RULES.SECONDS, low: g.timer <= BERRY_LOW_SECONDS });
  showHud();
  const rise = (sl, up) => life.tween({ targets: sl.sprite, y: up ? feet : feet + tall + 20, duration: 220, ease: up ? 'Back.easeOut' : 'Sine.easeIn' });
  const near = at => slots.find(sl => Math.abs(at.x - spotX[sl.i]) <= W * 0.15 && at.y >= feet - tall - 28);
  return {
    down: at => {
      if (!live || g.over) return;
      const kind = hang.findIndex(p => Math.hypot(at.x - p.x, at.y - p.y) <= Math.max(9, spacing / 2));
      if (kind < 0) return;
      drag = { kind, image: s.add.image(at.x, at.y, `amie-berry-${kind}`).setScale(1.7) };
      cue(screen, 'pick');
      onTree[kind].setAlpha(0.35);
      fx.add(drag.image);
    },
    move: at => { if (drag) drag.image.setPosition(at.x, at.y); },
    up: at => {
      if (!drag) return;
      const d = drag;
      drag = null;
      onTree[d.kind].setAlpha(1);
      const sl = near(at);
      const events = sl ? g.give(sl.i, d.kind) : [];
      if (events.length) { d.image.destroy(); play(events); return; }

      life.tween({ targets: d.image, y: H + 20, duration: 450, ease: 'Sine.easeIn' }).then(() => d.image.destroy());
    },
    frame: dt => {
      if (!live) return;
      play(g.step(dt));
      for (const sl of slots) if (sl.bubble.visible) sl.bubble.left.setScale(Math.max(0, g.slots[sl.i].left / 3), 1);
      showHud();
    },
  };

  function play(events) {
    for (const e of events) {
      const sl = slots[e.slot];
      switch (e.type) {
        case 'rise': rise(sl, true); break;
        case 'ask': sl.bubble.want.setTexture(`amie-berry-${e.want}`); sl.bubble.setVisible(true); break;
        case 'right':
          cue(screen, 'right');
          life.burst('heart', e.quick ? 3 : 2, spotX[e.slot], feet - tall, { into: fx });
          sl.bubble.setVisible(false); rise(sl, false);
          break;
        case 'wrong': case 'timeout':
          cue(screen, 'wrong');
          life.burst('anger', 1, spotX[e.slot] + 10, feet - tall, { into: fx, rise: 0.3 });
          sl.bubble.setVisible(false); rise(sl, false);
          break;
        case 'end':
          for (const one of slots) { one.bubble.setVisible(false); rise(one, false); }
          end(e.score, 'timeUp');
          break;
        default: break;
      }
    }
  }
}

function grassStrip(frames, W, H, animate) {
  const inner = svg => svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const row = svg => Array.from({ length: Math.ceil((W + 8) / 28) }, (_, i) => `<g transform="translate(${-4 + i * 28} ${H - 6})">${inner(svg)}</g>`).join('');
  const body = animate ? `<g style="animation:pkbA 3.2s steps(1) infinite">${row(frames[0])}</g><g style="opacity:0;animation:pkbB 3.2s steps(1) infinite">${row(frames[1])}</g>` : row(frames[0]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 ${H - 6} ${W + 8} 6"><g data-layer="L5">${body}</g></svg>`;
}

function headIt(s, layer, screen, level, end, life) {
  const W = screen.W, H = screen.H, words = screen.words, R = HEAD_RULES;
  const g = createHeadIt(level);

  const sky = { place: screen.place, time: screen.time, w: W, h: H, px: screen.unit, animate: !screen.still, bleed: true };
  const fever = life.scene(headItScene({ ...sky, fever: true, layers: ['fever'] }));
  fever.setVisible(false);
  layer.add([life.scene(headItScene(sky)).back, fever.back]);

  const kx = Math.min(0.85, (W * 0.34) / 100), ky = (H - screen.top - 4) / 600, baseY = H - 4;
  const fx = lx => W / 2 + lx * kx, fy = ly => baseY - (ly + 120) * ky;
  const tall = (fy(-120) - fy(-10));
  const players = threePlayers(screen.players);
  const mons = R.SLOT_X.map((lx, i) => {
    const sprite = monSprite(s, players[i], fx(lx), fy(-120), tall).setVisible(i === 0);
    layer.add(sprite);
    return sprite;
  });
  const balls = new Map();
  const ballLayer = s.add.container(0, 0);
  const effects = s.add.container(0, 0);
  layer.add([ballLayer, effects]);
  const setHud = hud(screen, words.games.head);
  let acc = 0, live = false;
  countIn(screen, life).then(() => { live = true; });
  const showHud = () => setHud({ score: `${g.fever ? `${words.fever}  ` : ''}${words.score.head({ n: g.points })}`, time: Math.max(0, g.timer) / R.TIME });
  showHud();
  const size = Math.max(10, R.BALL_H * ky * 0.75), giantSize = size * 3.2;

  const ballTexture = b => (b.kind === 'purple' || b.kind === 'giant' ? `amie-ball-${b.kind}` : `amie-ball-${Math.min(2, g.stage)}`);

  const alarm = s.add.container(fx(0), fy(-120) - tall - 10, [s.add.image(-4, 0, 'amie-bang'), s.add.image(4, 0, 'amie-bang')]).setVisible(false);
  layer.add(alarm);
  return {
    down: at => {
      if (!live) return;
      if (at.y < fy(120)) return;
      const slot = R.SLOT_X.findIndex((lx, i) => i < g.mons && Math.abs(at.x - fx(lx)) <= 53 * kx);
      if (slot < 0) return;
      play(g.tap(slot));

      life.tween({ targets: mons[slot], y: fy(-120) - 5, duration: 80, yoyo: true });
    },
    move: () => {},
    up: () => {},
    frame: dt => {
      fever.setVisible(!!g.fever && !g.over);
      if (!live || g.over) return;
      acc += dt;
      while (acc >= 1 / R.FPS && !g.over) {
        acc -= 1 / R.FPS;
        play(g.tick());
      }

      const seen = new Set();
      for (const b of g.balls) {
        seen.add(b);
        let image = balls.get(b);
        if (!image) {
          image = s.add.image(0, 0, ballTexture(b));
          image.setScale((b.kind === 'giant' ? giantSize : size) / image.width);
          ballLayer.add(image);
          balls.set(b, image);
        }

        image.setPosition(fx(b.x), fy(b.y) + (b.kind === 'giant' ? R.GIANT_H * R.GIANT_DROP * ky - giantSize / 2 : 0)).setAlpha(b.missed ? 0.5 : 1);
      }
      for (const [b, image] of balls) if (!seen.has(b)) { image.destroy(); balls.delete(b); }
      showHud();
    },
  };

  function play(events) {
    for (const e of events) {
      switch (e.type) {
        case 'stage':
          for (let i = 0; i < e.mons; i++) {
            if (mons[i].visible) continue;
            const y = mons[i].y;
            mons[i].setVisible(true).setY(y + tall + 10);
            life.tween({ targets: mons[i], y, duration: 300, ease: 'Back.easeOut' });
          }
          break;
        case 'hit': {
          cue(screen, e.how === 'just' ? 'headJust' : 'head');
          const x = fx(R.SLOT_X[e.slot]), y = fy(-10);
          life.burst(e.how === 'just' ? 'star' : 'spark', e.how === 'just' ? 2 : 1, x, y, { into: effects, rise: 0.8 });
          const pop = windowText(s, x, y - 8, `+${e.points}`, { fontSize: 56 }).setOrigin(0.5);
          effects.add(pop);
          life.tween({ targets: pop, y: y - 22, alpha: 0, duration: 700 }).then(() => pop.destroy());
          break;
        }
        case 'miss':
          alarm.setVisible(false);
          cue(screen, 'drop');
          life.burst('anger', 1, fx(R.SLOT_X[e.slot]), fy(-20), { into: effects, rise: 0.3 });
          break;
        case 'leave':

          for (const i of [1, 2]) if (mons[i].visible) life.tween({ targets: mons[i], y: mons[i].y + tall + 10, duration: 300, ease: 'Back.easeIn' }).then(() => mons[i].setVisible(false));
          break;
        case 'giant': alarm.setVisible(true); cue(screen, 'giant'); break;
        case 'bonus': {
          alarm.setVisible(false);
          cue(screen, 'bonus');
          const x = fx(0), y = fy(-10);
          life.burst('star', e.how === 'just' ? 4 : 2, x, y, { into: effects, rise: 0.8, scale: 1.4 });
          const pop = windowText(s, x, y - 8, `+${e.points}`, { fontSize: 72 }).setOrigin(0.5);
          effects.add(pop);
          life.tween({ targets: pop, y: y - 26, alpha: 0, duration: 900 }).then(() => pop.destroy());
          break;
        }
        case 'end': end(e.score, 'timeUp'); break;
        default: break;
      }
    }
  }
}

let pictureSeq = 0;

export const TILE_SEATS = Object.freeze([
  Object.freeze({ player: 1, x: 0.2, tall: 0.55, wide: 0.3 }), Object.freeze({ player: 2, x: 0.8, tall: 0.55, wide: 0.3 }), Object.freeze({ player: 0, x: 0.5, tall: 0.8, wide: 0.45 }),
]);

export function tileMonPlace(bw, bh, bounds, seat) {
  const b = bounds, k = Math.min((bh * seat.tall) / (b.bottom - b.top), (bw * seat.wide) / (b.right - b.left));
  return { k, ox: bw * seat.x - ((b.left + b.right) / 2) * k, oy: bh - 3 - b.bottom * k };
}

function tilePuzzle(s, layer, screen, level, end, life) {
  const W = screen.W, H = screen.H, words = screen.words;

  const grid = TILE_GRIDS[level], tall = H > W;
  const cols = tall ? grid.rows : grid.cols, rows = tall ? grid.cols : grid.rows;
  const g = createTilePuzzle(level);
  const tw = Math.floor((W - 12) / cols), th = Math.floor((H - screen.top - 12) / rows);
  const bw = tw * cols, bh = th * rows, x0 = Math.floor((W - bw) / 2), y0 = screen.top + 4 + Math.floor((H - screen.top - 8 - bh) / 2);
  layer.add(s.add.rectangle(0, 0, W, H, 0x23435f).setOrigin(0));

  layer.add(life.scene(tileFrameSvg({ bw, bh, level })).back.setPosition(x0, y0));

  const key = `amie-tile-${++pictureSeq}`;
  const canvas = s.textures.createCanvas(key, bw, bh);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  paintSvg(ctx, tilePicture({ place: screen.place, time: screen.time, w: bw, h: bh }), { k: 1 });
  const players = threePlayers(screen.players);
  TILE_SEATS.forEach(seat => {
    const a = players[seat.player], frame = s.textures.getFrame(a.key, a.frame);
    const { k, ox, oy } = tileMonPlace(bw, bh, a.bounds, seat);
    const trim = frame.data?.spriteSourceSize ?? { x: 0, y: 0 };
    ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      ox + (frame.trimmed ? trim.x : 0) * k, oy + (frame.trimmed ? trim.y : 0) * k, frame.cutWidth * k, frame.cutHeight * k);
  });
  for (let t = 0; t < cols * rows; t++) canvas.add(`t${t}`, 0, (t % cols) * tw, Math.floor(t / cols) * th, tw, th);
  canvas.refresh();
  const at = place => ({ x: x0 + (place % cols) * tw + tw / 2, y: y0 + Math.floor(place / cols) * th + th / 2 });
  const tiles = g.tiles.map((tile, place) => {
    const image = s.add.image(at(place).x, at(place).y, key, `t${tile}`);
    layer.add(image);
    return image;
  });

  const marks = s.add.graphics();
  layer.add(marks);
  const drawMarks = () => {
    marks.clear();
    g.tiles.forEach((tile, place) => {
      if (g.home(place)) return;
      const { x, y } = at(place), l = x - tw / 2 + 0.5, t = y - th / 2 + 0.5, r = x + tw / 2 - 0.5, b = y + th / 2 - 0.5, c = Math.min(5, tw / 4);
      marks.lineStyle(1, place === g.selected ? 0xff4040 : 0x3a8aff, 1);
      marks.strokeRect(l, t, r - l, b - t);
      marks.lineStyle(2, place === g.selected ? 0xff4040 : 0x2a6ad8, 1);
      for (const [px, py, dx, dy] of [[l, t, 1, 1], [r, t, -1, 1], [l, b, 1, -1], [r, b, -1, -1]]) marks.lineBetween(px, py, px + dx * c, py).lineBetween(px, py, px, py + dy * c);
    });
  };
  const byPlace = [...tiles];
  const setHud = hud(screen, words.games.tile);
  const fxLayer = s.add.container(0, 0);
  layer.add(fxLayer);
  let live = false;

  tiles.forEach((image, place) => { const p = at(g.tiles[place]); image.setPosition(p.x, p.y); });
  countIn(screen, life).then(() => {
    tiles.forEach((image, place) => life.tween({ targets: image, ...at(place), duration: 500, delay: (place % 7) * 40 }));
    life.after(800, () => { live = true; drawMarks(); });
  });

  const showHud = () => setHud({ score: words.score.tile({ n: Math.floor(g.seconds) }), time: null });
  showHud();
  layer.once('destroy', () => s.textures.remove(key));
  return {
    down: () => {},
    move: () => {},
    up: p => {
      if (!live || g.over) return;
      const col = Math.floor((p.x - x0) / tw), row = Math.floor((p.y - y0) / th);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;
      for (const e of g.pick(row * cols + col)) {
        if (e.type === 'select') cue(screen, 'tilePick');
        if (e.type === 'swap') {
          const a = byPlace[e.a], b = byPlace[e.b];
          byPlace[e.a] = b; byPlace[e.b] = a;
          life.tween({ targets: b, ...at(e.a), duration: 280 });
          life.tween({ targets: a, ...at(e.b), duration: 280 });
          for (const place of e.home) life.after(280, () => life.burst('star', 2, at(place).x, at(place).y, { into: fxLayer, rise: 0.5 }));
          cue(screen, e.home.length ? 'tileHome' : 'tileSwap');
        }
        if (e.type === 'end') life.after(600, () => end(e.seconds, 'done'));
      }
      drawMarks();
    },
    frame: dt => { if (live) { g.tick(dt); showHud(); } },
  };
}

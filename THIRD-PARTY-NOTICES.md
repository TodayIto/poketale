# Third-Party Notices

poke-battle is licensed under the GNU Affero General Public License v3.0 only
(`AGPL-3.0-only`, see [`LICENSE`](LICENSE)).

The distributed plugin is `dist/poke-battle.js`. Sections 1 and 2 identify bundled works and runtime assets; section 3 lists build tools.

Upstream revisions used for the build:

| Upstream | Revision |
|---|---|
| Pokémon Showdown (`smogon/pokemon-showdown`) | `c0845f33d381402dfcb18ce324c20a94f18af075` (package 0.11.11) |
| PokeRogue (`pagefaultgames/pokerogue`) | `7d7da4a829258b19e3f1615185fc6dd4d3d815f7` |
| PokeRogue assets (`pagefaultgames/pokerogue-assets`) | `37789817134f881da0a038af21991ccc93a66372` |
| PokeRogue locales (`pagefaultgames/pokerogue-locales`) | `485b48ebcd11b962b303875b9776fad9a844b6f7` |
| PokéAPI (`PokeAPI/pokeapi`, CSV data) | `2bf639e5572812a67d2b94903fdcb9d095f5aeb2` |
| Phaser (npm `phaser`) | 3.90.0 |
| eventemitter3 (npm, dependency of Phaser) | 5.0.4 |
| ts-chacha20 (npm, dependency of Pokémon Showdown) | 1.2.0 |
| Galmuri (npm `galmuri`) | 2.40.3 |

---

## 1. Included in `dist/poke-battle.js`

### 1.1 Pokémon Showdown — MIT

- Source: https://github.com/smogon/pokemon-showdown
- Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/
- License: MIT (text in [Appendix A](#a1-pokémon-showdown)); upstream file `LICENSE`.
- What is included: the battle simulator (`dist/sim/`, `dist/lib/`) and its data tables
  (`dist/data/`, including the `champions` mod chain), adapted for the browser at build time by
  `build/showdown.mjs` (file-system access replaced by static imports, server-only formats,
  random-team generation and text files left out, some fields unused by battles dropped from the
  data tables). The list of trainer sprite names in `server/chat-commands/avatars.tsx` is read
  by `tools/build-named-trainers.mjs` to build `data/named-trainers.json`.

### 1.2 ts-chacha20 — MIT (file header: BSD-3-Clause)

- Source: https://github.com/hscrypt/ts-chacha20 (npm `ts-chacha20`), bundled because Pokémon
  Showdown's PRNG (`sim/prng.js`) requires it.
- Package `LICENSE`: MIT, Copyright (c) 2017 Mykola Bubelich.
- The bundled file `build/src/chacha20.js` carries a BSD-3-Clause header,
  Copyright (c) 2017, Bubelich Mykola. Both texts are in [Appendix A](#a2-ts-chacha20).

### 1.3 Phaser — MIT

- Source: https://github.com/phaserjs/phaser
- Copyright (c) 2024 Richard Davey, Phaser Studio Inc. (individual source files also name
  Photon Storm Ltd. and other contributors as authors).
- License: MIT (text in [Appendix A](#a3-phaser)).
- What is included: a partial build of `phaser/src` (physics, tilemaps, loader, sound and the canvas renderer are left out).
- Phaser source files included in the bundle that carry their own notices:
  - `src/geom/polygon/Earcut.js` — based on Earcut, ISC License, Copyright (c) 2016, Mapbox
    ([Appendix A](#a4-earcut-in-phaser)).
  - `src/geom/polygon/Simplify.js` — based on Simplify.js, BSD-2-Clause,
    Copyright (c) 2017, Vladimir Agafonkin ([Appendix A](#a5-simplifyjs-in-phaser)).

### 1.4 eventemitter3 — MIT

- Source: https://github.com/primus/eventemitter3 (dependency of Phaser)
- Copyright (c) 2014 Arnout Kazemier
- License: MIT (text in [Appendix A](#a6-eventemitter3)).

### 1.5 PokeRogue code — AGPL-3.0-only

- Source: https://github.com/pagefaultgames/pokerogue
- Copyright 2024-2026 Pagefault Games (per upstream `REUSE.toml`).
- License: AGPL-3.0-only, the same license as this project ([`LICENSE`](LICENSE)).
- Functions and blocks from PokeRogue's battle scene, UI handlers, phases, battle animation
  player and enemy AI were translated to JavaScript and modified. Every such file starts with
  `// from pokerogue <upstream path> @ 7d7da4a8 (AGPL-3.0-only)`; at this revision these are
  37 files in `view/`, 3 in `ai/`, and 6 build-time extractors in `tools/` (the extractors
  are not part of the plugin file, only their output tables are).
- [`view/LICENSE-NOTE.md`](view/LICENSE-NOTE.md) (Korean) lists, file by file, which upstream
  file each piece comes from and what was changed.

### 1.6 Data from PokeRogue, PokeRogue assets and PokeRogue locales

These are embedded as generated modules (`embedded:anims`, `embedded:view`,
`embedded:pokerogue-boxes`, and tables under `data/`, `director/`, `ai/`).

| Data | Upstream files | License (per upstream `REUSE.toml` / `LICENSE`) |
|---|---|---|
| Move animation data (928 files, re-encoded by `view/anims/codec.js` and gzip-compressed) | assets `battle-anims/*.json` | see below |
| Texture atlas frame data (UI, status/type labels, party icons, trainers, animated arenas) and tables derived from it (`data/pokerogue-boxes.json`, `data/pokerogue-sprite-map.json`, `view/sprites/pokerogue-still.json`, `data/bag-icons.json`) | assets `images/**/*.json` | AGPL-3.0-only, Copyright 2024-2026 Pagefault Games ("JSONs created via our own tooling"). 7 trainer atlases (`player_{m,f}_2`, `player_{m,f}_alternate`, `halloween_rival_{m,f}`, `jacinthe_holo`) carry no annotation upstream. |
| Music loop points and track lists (`data/bgm.json`), cry table (`data/pokerogue-cries.json`) | assets `biome-bgm-loop-points.json`, PokeRogue `src/` | AGPL-3.0-only |
| Korean battle text, names, natures, ability/move descriptions, biome and trainer names (`director/text-*.json`, `data/names/*.json`, `data/story-names.json`, `data/named-trainers.json`) | locales `ko/*.json`, `en/*.json` | AGPL-3.0-only (locales `LICENSE`) |
| Enemy AI move scores (`ai/pokerogue-moves.json`), growth rates, bag/item data | PokeRogue `src/` | AGPL-3.0-only |

Move animation data, by upstream `battle-anims/REUSE.toml`:

- 785 files: **LicenseRef-POKEMON-REBORN**, The Pokémon Reborn Team
  (https://www.rebornevo.com/). Terms (https://www.rebornevo.com/pr/gamefaq/#borrow): "As long
  as you credit for anything used per any specifics in the Readme, you can borrow whatever you
  need as long as they are not used for the purpose of spreading hate and intolerance." The
  Reborn README credits these animators: Smeargletail, Mde2001, Autumn, VulpesDraconis,
  Amethyst, Crim, andracass, Koyoss, Jan; and notes that battle animations are shared between
  Pokémon Reborn, Rejuvenation and Desolation. Full text: upstream
  `LICENSES/LicenseRef-POKEMON-REBORN.txt` in pokerogue-assets.
- 49 files: **CC-BY-NC-SA-4.0** (https://creativecommons.org/licenses/by-nc-sa/4.0/),
  Gen 8 Animation Project, StCooler, DarrylBD99, WolfPP, ardicoozer, riddlemeree, Drake Baku:
  apple-acid, astral-barrage, aura-wheel, baddy-bad, behemoth-bash, behemoth-blade, bolt-beak,
  common-thunder-cage, core-enforcer, decorate, doom-desire, double-iron-bash, dragon-darts,
  dragon-energy, drum-beating, eerie-spell, expanding-force, false-surrender, fiery-wrath,
  first-impression, fleur-cannon, freezing-glare, fusion-bolt, glacial-lance, grav-apple,
  hold-hands, lands-wrath, lumina-crash, meteor-beam, misty-explosion, moongeist-beam,
  no-retreat, oblivion-wing, obstruct, precipice-blades, pyro-ball, scale-shot, solar-blade,
  spin-out, steel-roller, stone-axe, stuff-cheeks, sunsteel-strike, surging-strikes,
  syrup-bomb, tar-shot, teatime, thunder-cage, triple-axel. The re-encoding by this project is a
  modification of these files.
- The remaining 94 files: AGPL-3.0-only, Copyright 2024-2026 Pagefault Games.

### 1.7 PokéAPI data — BSD-3-Clause

- Source: https://github.com/PokeAPI/pokeapi (`data/v2/csv`), stored in `data/sources/pokeapi/`.
- Copyright (c) © 2013–2023 Paul Hallett and PokéAPI contributors
  (https://github.com/PokeAPI/pokeapi#contributing). Pokémon and Pokémon character names are
  trademarks of Nintendo.
- License: BSD-3-Clause ([Appendix A](#a7-pokéapi); also `data/sources/pokeapi/LICENSE.md`).
- What is included: Korean names, capture rates, effort values, TM numbers and Korean item
  descriptions, as converted into `data/names/*.json`, `data/catch-rates.json`, `data/exp.json`
  and `data/items-outside.json`.

### 1.8 Fonts (embedded as base64)

- **PkbPixel** — a subset of **Galmuri11** (Galmuri 2.40.3, https://github.com/quiple/galmuri),
  Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev), licensed under the
  **SIL Open Font License 1.1**. Full license text: [`data/fonts/OFL-Galmuri11.txt`](data/fonts/OFL-Galmuri11.txt)
  (identical to upstream `LICENSE.txt`). The subset (`data/fonts/galmuri11.woff2`, made by
  `tools/build-font.mjs`) keeps only the glyphs used and is renamed `PkbPixel`; its name table
  keeps the copyright and license entries.
- **BattleViewEmerald** — a subset of **Pokémon Emerald Pro** (`fonts/pokemon-emerald-pro.ttf`
  in PokeRogue assets), Copyright crystalwalrein 2013, made with FontStruct, licensed under
  **CC BY-SA 3.0** (http://creativecommons.org/licenses/by-sa/3.0/). The subset
  (`data/fonts/emerald-ko.woff2`, made by `tools/build-font.mjs`) keeps ASCII, all Hangul
  syllables and the other characters used, drops the unused `rtla` layout table, and keeps the
  glyph outlines, hinting and the full name table. The subset is distributed under the same
  license (CC BY-SA 3.0) with this attribution.

---

## 2. Downloaded at runtime (not in this repository, not in the plugin file)

The browser loads these directly from their hosts; nothing is copied into this repository or
into `dist/poke-battle.js`, and this project does not relicense them.

- **PokeRogue assets** — `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/37789817134f881da0a038af21991ccc93a66372/`:
  arena backgrounds, UI images, Pokémon/trainer/item images, effects, sound effects, cries and
  music. Licenses differ per file and are recorded in that repository's `REUSE.toml` files and
  `LICENSES/`: most original art and music is **CC-BY-NC-SA-4.0** (named artists, non-commercial),
  material from the original games is marked **LicenseRef-FAIR-USE** (Nintendo, Creatures Inc.,
  GAME FREAK inc.), and some files are LicenseRef-POKEMON-REBORN, CC0-1.0 or AGPL-3.0-only. The
  original `pokemon-emerald-pro.ttf` is downloaded only when the embedded subset cannot be loaded.
- **Pokémon Showdown sprites** — `https://play.pokemonshowdown.com/sprites/` (`ani`, `gen5ani`,
  `gen5`, `trainers`, `itemicons-sheet.png`). These images are not covered by Pokémon Showdown's
  MIT code license; they belong to their respective owners (Nintendo, Creatures Inc.,
  GAME FREAK inc., and the sprite artists credited by Pokémon Showdown).

---

## 3. Build-only tools (not in the plugin file)

- esbuild 0.28.2 — MIT, Copyright (c) 2020 Evan Wallace. Bundles the plugin; the small module
  helpers it writes into the output come from esbuild.
- sharp 0.35.5 — Apache-2.0. Used by table generators and tests to read PNG images.
- fontTools (Python) — MIT. Only needed when the font subsets must be regenerated.

---

## 4. Pokémon

Pokémon and Pokémon character names are trademarks of Nintendo. Pokémon © Nintendo,
Creatures Inc., GAME FREAK inc. This is an unofficial fan project. It is not affiliated with,
endorsed, sponsored or approved by Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon
Company, Pokémon Showdown or PokeRogue (Pagefault Games).

---

## Appendix A. License texts

The AGPL-3.0 text is in [`LICENSE`](LICENSE). The SIL OFL 1.1 text is in
[`data/fonts/OFL-Galmuri11.txt`](data/fonts/OFL-Galmuri11.txt). Creative Commons licenses are
referenced by URL above.

### A.1 Pokémon Showdown

```
The MIT License (MIT)

Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### A.2 ts-chacha20

```
MIT License

Copyright (c) 2017 Mykola Bubelich

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Header of `build/src/chacha20.js`:

```
Copyright (c) 2017, Bubelich Mykola
https://www.bubelich.com

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met, 0x

Redistributions of source code must retain the above copyright notice,
this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

Neither the name of the copyright holder nor the names of its contributors
may be used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

### A.3 Phaser

```
The MIT License (MIT)

Copyright (c) 2024 Richard Davey, Phaser Studio Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### A.4 Earcut (in Phaser)

```
ISC License

Copyright (c) 2016, Mapbox

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

### A.5 Simplify.js (in Phaser)

```
Copyright (c) 2017, Vladimir Agafonkin
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### A.6 eventemitter3

```
The MIT License (MIT)

Copyright (c) 2014 Arnout Kazemier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### A.7 PokéAPI

```
Copyright (c) © 2013–2023 Paul Hallett and PokéAPI contributors (https://github.com/PokeAPI/pokeapi#contributing). Pokémon and Pokémon character names are trademarks of Nintendo.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

* Neither the name of PokéAPI nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

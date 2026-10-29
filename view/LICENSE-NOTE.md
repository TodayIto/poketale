# PokeRogue adaptations

Portions of this project are adapted from [PokeRogue](https://github.com/pagefaultgames/pokerogue), revision `7d7da4a829258b19e3f1615185fc6dd4d3d815f7`, Copyright 2024-2026 Pagefault Games, licensed under AGPL-3.0-only.

Modified for PokeTale; modification notice date: 2026-10-28. Original source paths are listed below and retained in the corresponding source file headers. Full license and asset attribution information is in [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

## Changes

- The battle scene and UI were converted from TypeScript into JavaScript modules for an embedded plugin. Global scene, game progression, achievements, fusion, multiplayer and other unrelated systems were removed. Direct input handlers, callbacks and external battle state replace game phases and rule calculations.
- Arena, trainer, summon, recall, faint, capture, transformation, evolution, experience and level-up presentation were adapted to the plugin's scene lifecycle. Rendering uses Phaser objects, masks, tinting and tweens; the battle engine supplies outcomes. Capture animation follows the supplied capture result rather than rolling its own result.
- Battle text, menus, party, bag and summary views were adapted for Korean text, pointer and touch input, and externally supplied party and item state. Font loading uses embedded subsets. Sprites and generated atlas data are loaded through the plugin's asset adapters.
- Move animation playback was extracted into an independent player. Coordinate conversion, sprite clones, frame timing, color effects, audio and embedded animation data replace global scene dependencies.
- Opponent move and matchup scoring was adapted to the battle simulator's requests and copied engine state. Move attributes and other data are extracted by the included generators.
- Text and data extractors select the fields used by the plugin and emit standalone tables. Their output retains the applicable source and license attribution.

## Adapted source files

| File | Original PokeRogue path or component |
|---|---|
| `ai/index.js` | `src/phases/enemy-command-phase.ts, src/field/pokemon.ts (getNextMove), src/field/trainer.ts` |
| `ai/matchup.js` | `src/field/pokemon.ts, src/field/trainer.ts, src/data/arena-tag.ts` |
| `ai/move-score.js` | `src/data/moves/move.ts, src/field/pokemon.ts` |
| `tools/build-bag-data.mjs` | `locales/ko/*.json` |
| `tools/build-bgm.mjs` | `src/audio/audio-manager.ts, src/battle.ts` |
| `tools/extract-director-text.mjs` | `locales/ko/*.json` |
| `tools/extract-effects-text.mjs` | `locales/ko/*.json` |
| `tools/extract-exp-text.mjs` | `locales/{ko,en}/*.json` |
| `tools/extract-summary-text.mjs` | `locales/{ko,en}/*.json` |
| `view/anims/geometry.js` | `src/data/battle-anims.ts` |
| `view/anims/player.js` | `src/data/battle-anims.ts` |
| `view/anims/stat-stage.js` | `src/phases/stat-stage-change-phase.ts` |
| `view/arena.js` | `src/field/arena-base.ts`<br>`src/field/arena.ts (getBiomeKey, getBiomeHasProps)`<br>`src/battle-scene.ts (launchBattle arenaBg, loadBiomeAssets, base positions in reset)`<br>`src/enums/biome-id.ts` |
| `view/audio.js` | `src/audio/audio-manager.ts`<br>`src/audio/background-music.ts` |
| `view/ball-throw.js` | `src/phases/attempt-capture-phase.ts`<br>`src/data/pokeball.ts (doPokeballBounceAnim, getPokeballTintColor)`<br>`src/animations.ts (addPokeballOpenParticles, addPokeballCaptureStars)` |
| `view/bgm.js` | `src/battle.ts (getBgmOverride)`<br>`src/data/trainers/trainer-config.ts (battleBgm / victoryBgm defaults)` |
| `view/effects.js` | `src/phases/quiet-form-change-phase.ts`<br>`src/phases/pokemon-transform-phase.ts`<br>`src/phases/pokemon-anim-phase.ts`<br>`src/field/pokemon.ts`<br>`src/ui-inputs.ts` |
| `view/encounter.js` | `src/phases/encounter-phase.ts (doEncounter, doEncounterCommon)`<br>`src/phases/battle-phase.ts (hideEnemyTrainer)`<br>`src/phases/summon-phase.ts (preSummon's player ball throw)`<br>`src/field/trainer.ts (sprites, tint/untint, playAnim)`<br>`src/data/trainers/trainer-config.ts (loadAssets anims)` |
| `view/evolution.js` | `src/phases/evolution-phase.ts`<br>`src/ui/handlers/evolution-scene-ui-handler.ts`<br>`src/phases/end-evolution-phase.ts`<br>`src/animations.ts (doSpiralUpward , doArcDownward , doCycle , doCircleInward , doSpray)` |
| `view/flow-extras.js` | `src/phases/battle-phase.ts (showEnemyTrainer)`<br>`src/phases/attempt-capture-phase.ts (hideInfo after the catch is confirmed)` |
| `view/game-speed.js` | `src/system/game-speed.ts`<br>`src/utils/common.ts (FixedInt, fixedInt)` |
| `view/index.js` | `src/main.ts`<br>`src/scene-base.ts` |
| `view/level.js` | `src/phases/exp-phase.ts`<br>`src/phases/show-party-exp-bar-phase.ts`<br>`src/phases/level-up-phase.ts` |
| `view/run-away.js` | `src/phases/attempt-run-phase.ts`<br>`src/phases/command-phase.ts (handleRunCommand, queueShowText)` |
| `view/scene.js` | `src/battle-scene.ts`<br>`src/field/arena.ts`<br>`src/field/arena-base.ts`<br>`src/phases/summon-phase.ts`<br>`src/phases/switch-summon-phase.ts`<br>`src/phases/faint-phase.ts`<br>`src/phases/damage-anim-phase.ts` |
| `view/sprites/pokemon.js` | `src/field/pokemon.ts` |
| `view/tera.js` | `src/pipelines/glsl/sprite-frag-shader.frag`<br>`src/pipelines/sprite.ts`<br>`src/phases/tera-phase.ts`<br>`src/ui/battle-info/battle-info.ts`<br>`src/data/type.ts` |
| `view/ui/ability-bar.js` | `src/ui/containers/ability-bar.ts`<br>`src/phases/show-ability-phase.ts`<br>`src/phases/hide-ability-phase.ts` |
| `view/ui/action-menu.js` | `src/ui/handlers/command-ui-handler.ts`<br>`src/ui/handlers/fight-ui-handler.ts`<br>`src/ui/handlers/battle-message-ui-handler.ts`<br>`src/ui/text.ts`<br>`src/ui/ui-theme.ts` |
| `view/ui/bag.js` | `src/ui/handlers/ball-ui-handler.ts`<br>`src/ui/handlers/command-ui-handler.ts` |
| `view/ui/battle-info.js` | `src/ui/battle-info/battle-info.ts`<br>`src/ui/battle-info/player-battle-info.ts`<br>`src/ui/battle-info/enemy-battle-info.ts` |
| `view/ui/battle-stats.js` | `src/ui/battle-info/battle-info.ts`<br>`src/ui/battle-info/player-battle-info.ts`<br>`src/ui/battle-info/enemy-battle-info.ts` |
| `view/ui/exp-bar.js` | `src/ui/battle-info/player-battle-info.ts`<br>`src/ui/battle-info/battle-info.ts (setLevelDisplay)`<br>`src/ui/containers/party-exp-bar.ts` |
| `view/ui/keys.js` | `src/configs/inputs/cfg-keyboard-qwerty.ts`<br>`src/ui/ui.ts (playSelect / playError)` |
| `view/ui/learn-move.js` | `src/ui/handlers/base-option-select-ui-handler.ts`<br>`src/ui/handlers/confirm-ui-handler.ts`<br>`src/ui/handlers/summary-ui-handler.ts (SummaryUiMode.LEARN_MOVE, Page.MOVES)`<br>`src/ui/text.ts (SUMMARY*, WINDOW*, colours)`<br>`src/ui/ui.ts (fadeOut/fadeIn transition)` |
| `view/ui/level-up.js` | `src/ui/handlers/battle-message-ui-handler.ts (levelUpStatsContainer, promptLevelUpStats)` |
| `view/ui/mega-tera.js` | `src/ui/handlers/command-ui-handler.ts`<br>`src/ui/handlers/fight-ui-handler.ts` |
| `view/ui/message-codes.js` | `src/ui/handlers/message-ui-handler.ts (showTextInternal @c/@d/@s/@f codes)` |
| `view/ui/message.js` | `src/ui/handlers/message-ui-handler.ts`<br>`src/ui/handlers/battle-message-ui-handler.ts`<br>`src/phases/message-phase.ts` |
| `view/ui/party-icons.js` | `src/data/pokemon-species.ts (getIconAtlasKey/getIconId)`<br>`src/battle-scene.ts (addPokemonIcon)` |
| `view/ui/party.js` | `src/ui/handlers/party-ui-handler.ts`<br>`src/ui/utils/pokemon-icon-anim-helper.ts`<br>`src/ui/handlers/message-ui-handler.ts (showPrompt)` |
| `view/ui/rename-form.js` | `src/ui/handlers/rename-form-ui-handler.ts`<br>`src/ui/handlers/form-modal-ui-handler.ts`<br>`src/ui/handlers/modal-ui-handler.ts`<br>`src/ui/text.ts (TOOLTIP_CONTENT, SETTINGS_LABEL, addTextInputObject)` |
| `view/ui/summary.js` | `src/ui/handlers/summary-ui-handler.ts (SummaryUiMode.DEFAULT, Page.PROFILE/STATS/MOVES)`<br>`src/ui/handlers/party-ui-handler.ts (processSummaryOption)` |
| `view/ui/text.js` | `src/ui/text.ts`<br>`src/ui/handlers/summary-ui-handler.ts (getStatKey order)` |
| `view/ui/theme.js` | `src/ui/text.ts (getTextColor isLegacyTheme branch)`<br>`src/ui/ui-theme.ts (addWindow borders, legacy images)`<br>`src/scene-base.ts (loadImage: images/ui -> images/ui/legacy)` |
| `view/ui/window.js` | `src/ui/ui-theme.ts` |

## Fonts and assets

- The subset of **Pokémon Emerald Pro**, Copyright crystalwalrein 2013, is distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The subset retains ASCII, Hangul syllables and other displayed characters; unused glyphs and the unused `rtla` layout table were removed, while glyph outlines, hinting and the original name table were preserved.
- The subset of **Galmuri11**, Copyright (c) 2019-2025 Lee Minseo, is distributed under the [SIL Open Font License 1.1](../data/fonts/OFL-Galmuri11.txt). It is renamed **PkbPixel** and retains the original copyright and license entries.
- Images, sounds, animation data and other assets retain their own licenses and creator credits. See [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) for the applicable per-work terms and upstream attribution records.

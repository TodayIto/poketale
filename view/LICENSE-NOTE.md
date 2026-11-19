# PokeRogue 화면 코드 출처

원본: https://github.com/pagefaultgames/pokerogue

코드 커밋: `7d7da4a829258b19e3f1615185fc6dd4d3d815f7` (`7d7da4a8`). 가져와 고친 코드의 라이선스: **AGPL-3.0-only**.
원본 저작권 표기와 라이선스는 `vendor/pokerogue/LICENSE` 참조. 이 파일은 라이선스를 대신하지 않는다.

전체 게임 파일을 복사하지 않고 아래 함수/블록을 발췌해 JavaScript로 옮겼다. 각 파생 파일 상단에도 출처를 적었다.

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `index.js` | `src/main.ts`, `src/scene-base.ts` | 1920×1080, 320×180 좌표, 배율 6, pixelArt/FIT 설정. 게임·설정 의존성 제거 |
| `scene.js` | `src/battle-scene.ts` | 배경, field/fieldUI/UI 컨테이너 생성·깊이·배율. 작은 장면 하나로 변경 |
| `scene.js` | `src/field/arena.ts`, `src/field/arena-base.ts` | biome 배경·a/b 바닥 텍스처 지정. 규칙·날씨·장식·무작위 요소 제거 |
| `sprites/pokemon.js` | `src/field/pokemon.ts` | 그림+틴트 그림 생성, origin, playAnim/getSprite/getTintSprite/getSpriteScale/getFieldPositionOffset, tint/untint. 데이터·계산·globalScene 제거; T07에서 전체 프레임 union bbox의 고정 origin·가시 영역 배치·배율 적용 |
| `scene.js`, `ui/battle-info.js` | `src/field/pokemon.ts` | showInfo/hideInfo의 좌우 슬라이드 거리·시간·ease를 정보창 클래스로 이동 |
| `scene.js` | `src/phases/summon-phase.ts` | 볼 위치·650ms 투척, 150/500ms 포물선·회전, 틴트/배율 250ms, 등장 지연. 트레이너·파티·규칙 제거, Promise로 연결; 볼 열림 입자는 T35에서 더함(아래 T35 절). T07에서 볼 도착점을 새 배치에 연결하고 등장 배율을 최종 배율에 비례시킴 |
| `scene.js` | `src/phases/switch-summon-phase.ts` | 회수 틴트·최종 배율의 0.5배로 250ms 축소, 750ms 지연. 교체 결정 제거 |
| `scene.js` | `src/phases/faint-phase.ts` | 느린 울음 뒤 500ms Sine 하강, 정보창 숨김. 기절 판정·부활·승패·친밀도 제거. 원본의 +150 떨어지기는 T35에서 발밑 마스크로 가라앉기로 바꿈(아래 T35 절) |
| `scene.js` | `src/phases/damage-anim-phase.ts` | 효과별 hit/hit_strong/hit_weak, 100ms 간격 6회 번쩍임 뒤 HP 갱신. 피해 계산 제거 |
| `ui/battle-info.js` | `src/ui/battle-info/battle-info.ts`, `player-battle-info.ts`, `enemy-battle-info.ts` | 양쪽 위치·요소 좌표, HP 색 기준·Sine 트윈·250~5000ms 속도, 숫자 스프라이트. 경험치·퓨전·보스·도감·능력치·타입 제거 |
| `ui/message.js` | `src/ui/handlers/message-ui-handler.ts`, `battle-message-ui-handler.ts` | 메시지 배경·(12,-39) 위치·두 줄·20ms 문자 출력·확인 입력. 대사 명령·이름창·통계 제거; 긴 문장 페이지 처리 추가 |
| `ui/text.js` | `src/ui/text.ts` | 96/72px 글자, 1/6 배율, 원본 색·그림자. 설정·i18next 제거, 플러그인에 넣은 글꼴을 FontFace 로 올림(`fonts.js`) |
| `ui/window.js` | `src/ui/ui-theme.ts` | 원본 8px 테두리 nine-slice. 테마 전환·마스크 제거 |
| `anims/geometry.js`, `anims/player.js` | `src/data/battle-anims.ts` | 좌표 변환, 사용자/대상/그림 캐시, locked 유지, 우선순위, 50ms 프레임, 배경·소리 이벤트를 독립 재생기로 발췌. globalScene/규칙/대타·더블 제거, 내장 JSON과 직접 이미지/오디오로 교체. 원본 그림과 분리한 복제본 사용, tone은 Phaser ColorMatrix로 구현 |
| `anims/stat-stage.js` | `src/phases/stat-stage-change-phase.ts` | 빨강 atk/파랑 spd 화살표, 비트맵 마스크, 250/1500/250ms 트윈만 발췌. 능력치 계산 없이 받은 부호로 재생; 현재 그림의 위치·배율·발 원점을 마스크에 적용 |
| `ui/action-menu.js` | `src/ui/handlers/command-ui-handler.ts`, `src/ui/handlers/fight-ui-handler.ts` | 2열 커서, 선택/취소 흐름을 발췌. phase·규칙·기술 정보 오버레이 제거, 외부 MoveOption/한국어 타입·PP·직접 터치 입력으로 변경 |

`audio.js`는 위 연출 코드가 쓰는 소리 키를 `<audio crossOrigin>`로 연결하는 새 어댑터다. PokeRogue AudioManager 자체는 가져오지 않았다.
그림 셰이더는 가져오지 않았으며 Phaser 기본 tintFill과 겹친 틴트 스프라이트로 단순화했다.
`sprites/showdown.js`의 디코더는 이 저장소 `plugin/probe/main.js`에서 옮겨 예외 정리·대체 순서·모든 프레임의 불투명 영역 합집합·행 분할을 더했다.
`sprites/placement.js`와 `sprites/pokerogue.js`는 T07의 새 코드다. 각각 공통 배치 계산과 PokeRogue 아틀라스의 잘린 프레임 복원·상자 측정을 담당하며 PokeRogue 원본 코드를 새로 복사하지 않았다.

T09에서는 `sprites/placement.js`가 PokeRogue의 캔버스 아래 가운데 자리(player 106,148 / enemy 236,84)와 아틀라스 합친 상자를 기준으로 Showdown 그림의 넓이·아래 가운데를 맞춘다. PokeRogue 출처 그림은 원래 캔버스 원점과 1배를 유지한다. `anims/player.js`의 복제 그림 좌표에는 비대칭 가로 원점 보정 한 항을 더했다. 새 PokeRogue 코드 파일을 복사하지 않았다.

T11에서는 프레임별 불투명 픽셀 수의 중앙값으로 몸 넓이를 맞추고 배율을 1/12 단위로 반올림한다. T09의 합친 상자와 아래 가운데 자리는 유지한다. 새 `sprites/pixels.js`는 픽셀 수·중앙값 계산용 자체 코드다.

`tools/build-pokerogue-boxes.mjs`가 고정 원본의 `src/enums/{species-id,species-form-key}.ts`, `src/data/balance/species/generation-*.ts`를 읽어 `data/pokerogue-sprite-map.json`을 생성한다. 에셋의 `images/pokemon/*.json`, `images/pokemon/back/*.json`에서 sourceSize와 spriteSourceSize 합집합을 추출하고 각 PNG를 풀어 불투명 픽셀 수 중앙값을 더한 `data/pokerogue-boxes.json`은 `embedded:pokerogue-boxes`로 내장한다. 각 방향은 `[sourceW, sourceH, x, y, unionW, unionH, medianOpaquePixels]`다. 이미지 자체나 게임 규칙 코드는 이 표에 포함하지 않는다.

## 에셋

에셋 원본: https://github.com/pagefaultgames/pokerogue-assets

고정 커밋: `37789817134f881da0a038af21991ccc93a66372`.
그림/소리/글꼴은 원본 에셋의 라이선스·저작권 조건을 따른다. 원본 `REUSE.toml`, `LICENSES/` 및 파일별 표기를 참조한다.
포켓몬 관련 권리는 원 권리자에게 있다.

빌드에 포함한 JSON (`build/plugins.mjs`의 `embeddedView`):

- `images/ui/{overlay_hp,numbers,bg}.json`
- `images/statuses_ko.json`, `images/pb.json`
- `images/pokemon/{25,130}.json`, `images/pokemon/back/{25,130}.json`,
  `images/pokemon/shiny/{25,130}.json`, `images/pokemon/back/shiny/{25,130}.json` — 개발 페이지 빌드만 (`pokemonAtlases`, 배포 플러그인에는 넣지 않음)

런타임 직접 로드: plains 등 biome의 `images/arenas/*_{bg,a,b}.png`, 위 아틀라스의 PNG,
`images/ui/pbinfo_{player,enemy_mini}.png`, 한국어 HP/Lv 라벨, `images/ui/windows/window_1.png`, `images/ui/prompt.png`,
`audio/se/{pb_rel,hit,hit_strong,hit_weak,faint}.wav`, `audio/cry/<번호>.m4a`, `audio/bgm/battle_wild.mp3`.

글꼴 (CLEAN-1): `fonts/pokemon-emerald-pro.ttf` 를 받지 않고 **조각을 플러그인에 넣는다** — `tools/build-font.mjs` 가 ASCII·한글 음절 전부·우리 문구에 쓴 글자만 남겨
`data/fonts/emerald-ko.woff2` 로 만들고(글자 수를 줄이고 쓰지 않는 레이아웃 표(rtla)를 뺀 것, 그리고 아래 두 글자 외에 글자 모양·힌팅은 그대로), `build/plugins.mjs` `FONT_FILES` 가 base64 로 넣는다.
**고친 글자 (FONT-GENDER, 2026-11-09)**: ♂(U+2642)·♀(U+2640) 두 글리프의 모양을 우리가 그린 픽셀 그림(`view/gender-mark.js` `GENDER_MARK_BATTLE`, 본편 모양 — ♂ 화살이 오른쪽 위로 비스듬히)으로 바꿨다.
글꼴의 16픽셀 격자(64단위 한 픽셀)에 9픽셀 높이, 기준선 위. ♂ 너비 6 → 9픽셀, ♀ 6 그대로. 다른 글리프는 그대로.
내장 글꼴이 안 올라갈 때만 원본 TTF 를 직접 받는다. 이 글꼴의 권리 표기는 글꼴 파일 name 표의 것: "Pokémon Emerald Pro", Copyright crystalwalrein 2013,
FontStruct 로 만듦, **CC BY-SA 3.0** (http://creativecommons.org/licenses/by-sa/3.0/). 조각에도 name 표를 전부 남긴다. 조각은 원본을 고친 것(글자 줄이기 + 위 두 글자 모양)이므로 같은 조건(CC BY-SA 3.0, 저작자 표시, 고친 것 표시 — 이 글과 THIRD-PARTY-NOTICES.md 1.8)으로 배포한다.

Showdown 그림은 `play.pokemonshowdown.com/sprites/`의 ani → gen5ani → gen5 원본을 사용한다.

## T18 (특성 팝업·능력치 패널·폼 변화·대타)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/ability-bar.js` | `src/ui/containers/ability-bar.ts`, `src/phases/show-ability-phase.ts`, `hide-ability-phase.ts` | 기본(레거시 아님) 테마의 118×31 막대·글자 자리(15,3)·72px·숨김 x=-118·내 쪽 y=-116/상대 -130·500ms Sine.easeOut+1000ms 멈춤·200ms 내림. 더블 위치·패시브·레거시 nine-slice 제거, 문구 틀은 `fight-ui-handler.json` 의 abilityFlyInText 를 코드에 둠 |
| `ui/battle-stats.js` | `src/ui/battle-info/battle-info.ts`(constructStatContainer·updateStats·toggleStats), `player-battle-info.ts`, `enemy-battle-info.ts` | 능력치 순위 패널의 자리 계산식·순서·125ms 토글 그대로. 보스·미니 전환·치명 표시 제거. 정보창(BattleInfo)에 나중에 붙인다 |
| `effects.js` | `src/phases/quiet-form-change-phase.ts`, `pokemon-transform-phase.ts`, `pokemon-anim-phase.ts`(대타 4종), `src/field/pokemon.ts`(getSubstituteOffset), `src/ui-inputs.ts`(buttonStats) | 폼 변화 흰 실루엣 1000/500/1000ms, 변신 즉시 교체+소리, 대타 인형 생성·앞뒤 이동·8번 깜빡임, STATS 버튼(C·Shift, 터치는 정보창 누르기). 셰이더(팔레트·테라 색) 대신 tintFill, 규칙·태그 계산 제거 |
| `anims/player.js` | (기존) | `playCommon` 에 대상 쪽 인자 추가 (씨뿌리기처럼 건 쪽→걸린 쪽) |

빌드에 새로 넣은 JSON (`embedded:view`): `images/ui/pbinfo_stat_numbers.json`, `images/ui/text_images/ko/battle_ui/pbinfo_stat_ko.json`.
런타임 직접 로드 추가: `images/ui/ability_bar_{left,right}.png`, `images/ui/pbinfo_{player,enemy_mini}_stats.png`, `images/ui/pbinfo_stat_numbers.png`,
`images/ui/text_images/ko/battle_ui/pbinfo_stat_ko.png`, `images/pokemon/sub.png`, `images/pokemon/back/sub.png`,
`audio/battle_anims/PRSFX- Transform.wav`, `audio/battle_anims/PRSFX- Substitute2.wav`, 그리고 기존 `battle-anims/common-*.json`·`*-charging.json` 이 가리키는 그림·소리.
`director/text-effects-ko.json` 은 `locales/ko` 의 battler-tags·arena-tag·weather·terrain·ability-trigger·modifier·move-trigger·pokemon-form-battle·status-effect 전체와 battle·fight-ui-handler·pokemon-info 일부를 평탄화한 것 (문장 수정 없음).

## T19 (메가진화·테라스탈)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/mega-tera.js` | `src/ui/handlers/command-ui-handler.ts`, `src/ui/handlers/fight-ui-handler.ts` | 테라 버튼 자리 (217,-38.7)+(-32,15)·1.3배·타입 프레임, ←/→/결정 흐름, 버튼 칸이면 커서 숨김, 메시지 줄바꿈 910, 기술 메뉴 `cursor_tera` 0.7배. 더블(fieldIndex)·테라 횟수 계산 제거 (감독이 request 로 알려 줌). 메가 버튼은 원본 없음 — 같은 자리에 `items/mega_bracelet.png` |
| `tera.js` | `src/pipelines/glsl/sprite-frag-shader.frag`(191-206행과 도우미 함수), `src/pipelines/sprite.ts`, `src/phases/tera-phase.ts`, `src/ui/battle-info/battle-info.ts`(teraIcon), `src/data/type.ts`(getTypeRgb) | 셰이더의 테라 부분만 PostFX 로 (팔레트·융합·그림자·밤낮 색 제거, 화면 좌표 → 그림 좌표 변환 추가, 무늬 좌표 fract), 정보창 아이콘 자리·색, 테라스탈 순서(애니 → 빛) |

런타임 직접 로드 추가: `images/ui/button_tera.png`(+JSON 내장, `embedded:view`), `images/ui/cursor_tera.png`, `images/ui/icon_tera.png`, `images/effects/tera.png`, `images/items/mega_bracelet.png`,
그리고 기존 `battle-anims/common-terastallize.json` 이 가리키는 그림·소리.

## T21 (가방 화면·볼 던지기·도구 대상 고르기)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/bag.js` (새) | `src/ui/handlers/ball-ui-handler.ts`, `command-ui-handler.ts` | 볼 메뉴 창(오른쪽 아래 −49, 폭 50+내용, 높이 112), 줄 16 간격의 그림(24)·이름(36)·×개수·"취소"(18), 커서 (12, 16+16n), 커서 칸 그림 흔들기(+4·27.5°·150ms·1초 쉼) 그대로. 칸(회복/상태/배틀/볼) 줄·도구 그림(반 크기)·6줄 넘김(↑/↓)·못 쓰는 도구 회색과 이유 문구는 원본에 없어 같은 창·글꼴로 덧붙임. 실제 사용은 감독(규칙 없음) |
| `ball-throw.js` (새) | `src/phases/attempt-capture-phase.ts`, `src/data/pokeball.ts`(doPokeballBounceAnim·getPokeballTintColor), `src/animations.ts`(addPokeballOpenParticles·addPokeballCaptureStars·doFanOutParticle) | 던지기 (16,80)→(236,16) 500ms·300ms 뒤 상대 뒤로, 열림 프레임·소리·볼 색 물들이기·파티클, 빨려 들어감 500ms 0.25배 y=20, 닫힘, 튕김(위력 절반씩), 흔들기 시간표(1초 바퀴, 4px·27.5°), 잠금 소리·별·볼 그림자, 실패 시 튀어나옴·울음소리. 흔들 때마다 굴리던 난수는 빼고 엔진이 정한 횟수·결과대로. 잡은 뒤 파티 넣기·도감·업적·정보창 표시는 뺌. 트레이너가 쳐내는 연출은 원본에 없어 새로 씀(튕겨 떨어지며 사라짐) |
| `ui/party.js` | `src/ui/handlers/party-ui-handler.ts` | 도구 대상 고르기: MODIFIER 모드 칸 메뉴 "사용한다", MOVE_MODIFIER 모드 칸 메뉴 = 기술 "이름 PP/최대"·"기술을 선택해 주십시오"·기술 거름 문구 (몇 줄) |
| `ui/action-menu.js` | (기존) | 가방이 있으면 명령 "볼" 칸을 "가방"으로, 누르면 `ui/bag.js` (몇 줄) |

빌드에 넣은 JSON: `data/bag-icons.json` (`tools/build-bag-data.mjs` 가 `images/items.json` 에서 가방 도구 24개 프레임만, `images/effects/pb_particles.json` 전체를 뽑음. 상태이상 약 5종은 원본에 가방 그림이 없어 트레이너 도구 그림 `wl_*` 을 우리 id 로).
런타임 직접 로드 추가: `images/items.png`, `images/effects/pb_particles.png`, `audio/se/{pb_throw,crit_throw,pb_catch,pb_bounce_1,pb_move,pb_lock}.wav`. 볼 그림은 기존 `images/pb.png`(pb·gb·ub·mb·lb, 나머지 볼은 pb 로 대체).
`director/text-bag-ko.json` 은 `locales/ko` 의 battle(singleWildAppeared·pokemonCaught·pokemonBrokeFree·noPokeballTrainer·noPokeballForce·regainHealth·ppHealBerry)·party-ui-handler(anyEffect·hasEnergy)·status-effect(*.heal) 를 뽑은 것 (문장 수정 없음).

## T23 (경험치·레벨업·기술 배우기·진화)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/exp-bar.js` | `src/ui/battle-info/player-battle-info.ts`(경험치 바·updatePokemonExpDisplay·doUpdateExpAnimation·setLevelDisplay), `battle-info.ts`(setLevelDisplay), `src/ui/containers/party-exp-bar.ts` | 바 자리·마스크(127,126,85,2)·510 폭·1650ms 기준·레벨 차 배율·se/exp·se/level_up·numbers_red 그대로. 경험치 속도 설정은 기본값만, 비율은 감독이 준다. 벤치 창은 y 를 돈 글자 대신 고정값(-148) |
| `ui/level-up.js` | `src/ui/handlers/battle-message-ui-handler.ts`(levelUpStatsContainer·promptLevelUpStats) | 창·글자 자리 그대로, BBCode 글자 대신 오른쪽 정렬 글자 |
| `ui/learn-move.js` | `base-option-select-ui-handler.ts`·`confirm-ui-handler.ts`(예/아니오), `summary-ui-handler.ts`(LEARN_MOVE 모드·Page.MOVES·move effect), `text.ts`(SUMMARY·WINDOW 색), `ui.ts`(fadeOut/fadeIn) | 요약 화면은 기술 쪽만 (능력치·프로필 쪽·사탕·친밀도·리본·도감 번호 금색 등 제외). 포켓몬 그림은 Showdown 앞모습 |
| `evolution.js` | `src/phases/evolution-phase.ts`, `end-evolution-phase.ts`, `src/ui/handlers/evolution-scene-ui-handler.ts`, `src/animations.ts`(doSpiralUpward·doArcDownward·doCycle·doCircleInward·doSpray) | 시간·입자 수식 그대로. 셰이더 대신 tintFill, 진화 멈춤(pauseEvolutions) 질문은 뺌 |
| `level.js` | `exp-phase.ts`, `show-party-exp-bar-phase.ts`, `level-up-phase.ts` | 화면 API 묶음 |

빌드에 새로 넣은 JSON (`embedded:view`): `images/ui/numbers_red.json`, `images/ui/summary_moves_cursor.json`.
런타임 직접 로드 추가: `images/ui/{overlay_exp,numbers_red,party_exp_bar,summary_bg,summary_moves,summary_moves_effect,summary_moves_overlay_row,summary_moves_cursor,summary_status}.png`,
`images/ui/text_images/ko/battle_ui/overlay_exp_label_ko.png`, `images/ui/text_images/ko/summary/summary_{tabs_3,dexnb_label,moves_moves_title,moves_descriptions_title,moves_effect_title,moves_overlay_pp}_ko.png`,
`images/arenas/default_bg.png`, `images/effects/evo_sparkle.png`, `images/effects/evo_bg.mp4`(<video>, 못 받으면 없이), `audio/se/{exp,level_up,level_up_fanfare,charge,beam,sparkle,shine}.wav`,
`audio/bgm/bw/{evolution,evolution_fanfare}.mp3`. `director/text-exp-ko.json` 은 `locales/ko` battle·menu 일부와 move.json 의 effect(기술 설명, Showdown id 로 묶음) — 문장 수정 없음.

## T27 (도망가기)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `run-away.js` | `src/phases/attempt-run-phase.ts`(성공: se/flee, arenaEnemy·상대 alpha 0 250ms Sine.easeIn, hideInfo), `src/phases/command-phase.ts`(handleRunCommand·queueShowText — 막힘 문구 뒤 명령 메뉴), `src/ui/handlers/command-ui-handler.ts`(show 의 커서 유지) | 판정(calculateEscapeChance·RunSuccessAbAttr)은 가져오지 않음 — 9세대 본가 공식은 엔진 `engine/run.mjs`. 상대 destroy 대신 숨김, BattleEndPhase·NewBattlePhase 대신 `end({outcome:'run'})` |

런타임 직접 로드 추가: `audio/se/flee.wav`. 문구는 `locales/ko/battle.json` 의 runAwaySuccess·runAwayCannotEscape·noEscapeTrainer·noEscapePokemon·noEscapeFlee·escapeVerbFlee (`director/text-ko.json`, 문장 수정 없음).

## T29 (바이옴 · 배틀 시작 연출)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `arena.js` | `src/field/arena-base.ts`(ArenaBase.setBiome: 발판·소품 3개·propValue 비트·움직이는 그림 12fps), `src/field/arena.ts`(getBiomeKey·getBiomeHasProps), `src/battle-scene.ts`(launchBattle 의 arenaBg 배율 6, loadBiomeAssets 의 아틀라스 여부, reset 의 발판 자리), `src/enums/biome-id.ts`(이름 목록) | 바이옴 바꾸기 전환(arenaBgTransition·arenaNextEnemy)·시간대 색(FieldSpritePipeline)·지형 색 비율은 가져오지 않음. propValue 는 웨이브 시드 대신 Math.random (또는 화면 옵션) |
| `encounter.js` | `src/phases/encounter-phase.ts`(doEncounter 의 ±300 2초 트윈·playBgm, doEncounterCommon 의 untint 100ms·cry·showInfo·trainer.playAnim), `src/phases/battle-phase.ts`(hideEnemyTrainer), `src/phases/summon-phase.ts`(preSummon 의 주인공 `_pb` 프레임 2·3, x −36, 750ms 뒤 볼), `src/field/trainer.ts`(컨테이너 −72,80·그림+tint 그림·원점 아래 가운데·tint/untint·playAnim repeat 0), `src/data/trainers/trainer-config.ts`(loadAssets: 0001~0128.png 24fps) | 트레이너 대사(encounter 메시지·charSprite)·볼 트레이(pbTray)·셰이더 그림자(hasShadow)·더블 트레이너·트레이너 이름(감독의 p2 이름을 그대로)은 가져오지 않음. 볼 꺼내는 순서는 감독(director/steps.js)이 정함 |
| `field-atlases.js`, `../build/field-atlases.mjs` | (데이터) `images/trainer/*.json`, `images/arenas/{end_a,end_b,end_b_3,power_plant_b_3}.json` | 원본 JSON 을 프레임 자리 표로 줄여 넣음 (트레이너는 애니 0001~0128 + 첫 프레임만, 안 잘린 프레임은 Phaser 가 쓰는 값으로). 그림은 바꾸지 않음 |
| `bgm.js` | `src/field/arena.ts`(bgm = getBiomeKey), `src/battle.ts`(getBgmOverride 의 클래식 1~4웨이브 battle_wild) | 야생이고 town 이 아닌 바이옴을 고르면 지역 곡 (몇 줄) |

빌드에 새로 넣은 데이터 (`embedded:view` 의 `FIELD_ATLASES_GZ_B64`, gzip+base64 26KB): 트레이너 308개·움직이는 바이옴 4개의 프레임 자리.
런타임 직접 로드 추가: `images/arenas/<바이옴>_{bg,a,b,b_1,b_2,b_3}.png`(고른 바이옴만), `images/trainer/<상대 트레이너>.png`, `images/trainer/trainer_{m,f}_back{,_pb}.png`(고른 쪽만), `audio/bgm/<바이옴>.mp3`(야생 + 바이옴을 고른 경우).

## T30 (파티 화면 "능력치를 본다" — 요약 화면)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/summary.js` (새 파일) | `src/ui/handlers/summary-ui-handler.ts`(SummaryUiMode.DEFAULT: setup·show·processInput·setCursor·populatePageContainer PROFILE/STATS/MOVES·showStatus/hideStatus·showMoveSelect/hideMoveSelect), `party-ui-handler.ts`(processSummaryOption) | 좌표·글자 모양·페이지 밀기(214, 250ms)·↑↓ 파티원·개체값 보기 그대로. 뺀 것: 사탕·우승 리본·행운·퓨전·패시브·지닌 도구 아이콘·메모 둘째 줄(만난 곳)·기술 순서 바꾸기/잊기·UI 효과음·그림 셰이더(이로치 색·테라 빛). 터치 조작(밀기·탭 글자·머리글)은 원본에 없어 새로 씀 |
| `ui/learn-move.js` | (T23) `summary-ui-handler.ts` | 기술 쪽 조립을 `buildMoveEffect`·`buildMovesPage`·`MoveDetails` 로 떼어 요약 화면과 같이 씀. DEFAULT 모드 다섯째 줄("그만둔다")·hideMoveSelect·효과 창 보임 상태(moveEffectsVisible) 추가, 글자 모양 SUMMARY_STATS(_PINK/_BLUE/_GOLD)·SUMMARY_RED·금색 도감 번호·성별 색 추가 |
| `ui/party.js` | `party-ui-handler.ts`(addCommonOptions 의 SUMMARY) | 칸 메뉴 "그만둔다" 앞에 "능력치를 본다" (칸에 summary 가 있을 때, 기술 고르기 모드 제외), 요약 화면이 열려 있는 동안 키를 넘김 (몇 줄) |

빌드에 새로 넣은 JSON: 없음 (`summary_moves_cursor`·`button_tera` 아틀라스는 이미 `embedded:view`).
런타임 직접 로드 추가: `images/ui/{summary_profile,summary_stats,summary_stats_overlay_exp,summary_profile_prompt_z,shiny,friendship,friendship_overlay}.png`,
`images/ui/text_images/ko/summary/summary_{tabs_1,tabs_2,dexnb_label_overlay_shiny,profile_profile_title,profile_ability,profile_memo_title,stats_item_title,stats_stats_title,stats_exp_title,stats_expbar_title}_ko.png`
(요약 화면을 처음 열 때). `director/text-summary-ko.json`(`tools/extract-summary-text.mjs`) 은 `locales/ko` 의 nature.json(성격 이름 25)·pokemon-summary.json natureFragment·ability.json description(Showdown 특성 id 로 묶음) — 문장 수정 없음.

**T36 추가**: `flow-extras.js` — `src/phases/battle-phase.ts`(showEnemyTrainer 의 x −16·y +16·alpha 1·750ms), `src/phases/attempt-capture-phase.ts`(잡았다 확인 뒤 hideInfo).
`ui/message-codes.js` — `src/ui/handlers/message-ui-handler.ts`(@c/@d/@s/@f 풀기, delayMap·soundMap 동작), `src/utils/common.ts`(getFrameMs). 글자 자리 세는 방식(공백 제외)은 자체.

## T35 (화면 다듬기)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `scene.js` | `src/phases/faint-phase.ts`, `src/phases/summon-phase.ts`(addPokeballOpenParticles 호출) | 기절: 원본의 +150 떨어지기 대신 발밑 선에서 잘리는 마스크로 그림 높이만큼 가라앉기 (본가 기준, 원본에 없음 — 새로 씀). 시간·감속(500ms Sine.easeIn)은 원본. 내보낼 때 볼 열림 입자 (x, y−16) |
| `ball-throw.js` | `src/animations.ts`(addPokeballOpenParticles) | 이미 옮긴 함수를 내보내기에서도 쓰게 export 만 |
| `ui/message.js` | `src/ui/handlers/message-ui-handler.ts`(showPrompt) | ▼ 자리 = 마지막 줄 글자 끝 +2, 줄마다 18 |
| `ui/action-menu.js`, `ui/mega-tera.js` | `src/ui/handlers/command-ui-handler.ts`(show), `fight-ui-handler.ts`(show·setMoveInfo·getMoveColor), `src/data/type.ts`(getTypeDamageMultiplierColor), `locales/ko/fight-ui-handler.json` | 명령·기술 커서 기억, 위력·명중률 줄, 상성 글자색 (배율은 감독이 줌). 상대 정보창 옆 배율 창(enemy-battle-info.ts)은 안 가져옴 |
| `ui/party.js` | `src/ui/ui.ts`(setModeInternal 전환·fadeOut·fadeIn) | 파티 화면 열고 닫을 때 250 → 100 → 250ms 검은 판 |
| `ui/bag.js` | — | 6줄 넘는 목록의 휠·끌기·↑↓ 누르기 (원본 볼 메뉴엔 없음 — 새로 씀) |
| `retry.js` (새 파일) | — | 그림·글꼴 받기 다시 시도 (새로 씀) |

빌드에 새로 넣은 데이터: 없음. 런타임 직접 로드 추가: `images/effects/pb_particles.png` 를 준비(preload) 때 받는다 (예전엔 볼을 던질 때만).

## MOVE-REMINDER (기술 떠올리기, 2026-11-03)

| 우리 파일 | 원본 경로 | 발췌·변경 범위 |
|---|---|---|
| `ui/party.js` | `src/ui/handlers/party-ui-handler.ts`(REMEMBER_MOVE_MODIFIER: updateOptionsWithRememberMoveModifierMode·addCancelAndScrollOptions·updateOptionsWindow 의 앞 글자·setOptionsCursor 넘김·processRememberMoveModeInput/UpDownInput) | 칸 메뉴 = 떠올릴 기술 (이름만, 9개 넘으면 8줄 + ↑ ↓ 줄), 커서 기술의 정보 창. 바꾼 것: 포켓몬은 패널에서 이미 골랐으므로 그 칸의 목록이 열린 채 시작하고 B·그만둔다는 칸 고르기로 돌아가지 않고 닫음, 앞 글자(레벨) 없음·안내 줄 없음(원본은 레벨 숫자와 "어떻게 하겠습니까?"), ↑ ↓ 줄은 누르면 한 줄 넘김(원본은 커서가 올라갈 때만), 알·기술머신·퓨전 출처 없음 |
| `ui/move-info.js` (새 파일) | `src/ui/containers/move-info-overlay.ts` | 파티 화면이 쓰는 배치(top, x 1, 폭 130)만. 타입·분류 그림, PP·위력·명중률, 설명(3줄 넘으면 2초마다 흐름). 값은 감독이 줌 (LearnMoveOption) |
| `text.js` | `src/ui/text.ts`(MOVE_INFO_CONTENT) | 56px, 창 글자 색 |

빌드에 새로 넣은 데이터: `view/text-*.json` 에 `fight-ui-handler.pp` 한 줄 (`tools/extract-view-text.mjs`).

## 기술 연출 묶음 (8·9세대 기술 연출 프로젝트, 0.0.9)

출처: https://www.pokecommunity.com/threads/the-gen-9-move-animation-project.526189/ (Essentials 형식 `PkmnAnimations.rxdata`). 첫 글의 조건 "Please include these credits when adding these animations to your game" 에 따라 크레딧을 그대로 적는다:

> Thanks to the Reborn team for letting people use their resources. You are awesome.
>
> Gen 8 Animation Project lead by StCooler, with additional contributions by DarrylBD99, WolfPP, ardicoozer, riddlemeree
>
> Thanks to BellBlitzKing for his Pokemon Sound Effects Pack: Gen 1 to Gen 7 - All Attacks SFX.
>
> Gen 9 Animation Project led by KRLW890 and Nut0066, with additional contributions by Toxillian, QuahogTheCreator, Lcorp, and Shashu-Greninja

| 우리 파일 | 묶음에서 가져온 것 |
|---|---|
| `anims/tints.js` | PokeRogue 변환에서 색이 빠진 18개 기술의 배경 시간표 — 그림 이름·투명도·자리·색·프레임, 원본 값 그대로. `tools/build-anim-tints.mjs` 가 묶음에서 만든다. `anims/bg-engine.js` 가 원본 플레이어 규칙대로 재생한다 |
| `anims/bg-names.js` | 빈칸이 된 배경 그림 이름 15개 기술 |

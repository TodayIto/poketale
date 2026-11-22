# 이름표 빌드 자료

이 폴더는 빌드에 쓰는 원본 CSV와 출처·체크섬을 보관한다. CSV는 브라우저 번들에 포함하지 않는다.

| 출처 | 고정 판 | 사용 자료 |
|---|---|---|
| [Showdown](https://github.com/smogon/pokemon-showdown/tree/c0845f33d381402dfcb18ce324c20a94f18af075) | `c0845f33d381402dfcb18ce324c20a94f18af075` | 빌드된 Dex의 species/moves/abilities/items, champions 모드에서 같은 ID의 exists 확인 |
| [PokeRogue](https://github.com/pagefaultgames/pokerogue/tree/7d7da4a829258b19e3f1615185fc6dd4d3d815f7) | `7d7da4a829258b19e3f1615185fc6dd4d3d815f7` | locales/assets 서브모듈의 상위 저장소 |
| [PokeRogue locales](https://github.com/pagefaultgames/pokerogue-locales/tree/485b48ebcd11b962b303875b9776fad9a844b6f7) | `485b48ebcd11b962b303875b9776fad9a844b6f7` | en/ko의 pokemon.json, move.json, ability.json, pokemon-form.json 및 ko의 pokemon-form-battle.json, pokemon-info.json |
| [PokeRogue assets](https://github.com/pagefaultgames/pokerogue-assets/tree/37789817134f881da0a038af21991ccc93a66372) | `37789817134f881da0a038af21991ccc93a66372` | battle-anims/*.json 파일명 |
| [PokeAPI CSV](https://github.com/PokeAPI/pokeapi/tree/2bf639e5572812a67d2b94903fdcb9d095f5aeb2/data/v2/csv) | `2bf639e5572812a67d2b94903fdcb9d095f5aeb2` | pokeapi/source.json에 명시한 CSV (machines.csv, 한국어 줄만 남긴 item_flavor_text.ko.csv 포함) |

PokeRogue locale은 AGPL-3.0-only 자료다. 프로그램 코드를 복사하지 않고 이름 문자열·폼 템플릿·타입 이름을 읽어 변환했다.
PokeAPI의 라이선스 전문은 `pokeapi/LICENSE.md`에 보관한다.

CSV의 `local_language_id=3`은 한국어, `9`는 영어다. 이름표에 필요 없는 열은 출력하지 않는다.
영어 이름을 정규화해 대응한다. 원본 숫자 ID가 Showdown 번호와 같다고 가정하지 않는다.
폼은 `pokemon_forms → pokemon → species_id`를 따라 같은 종인지 확인한다.

다운로드 주소는 `https://raw.githubusercontent.com/PokeAPI/pokeapi/<고정 커밋>/data/v2/csv/<파일>`이다.
CSV 내용은 그대로 두고 CRLF 줄바꿈만 LF로 정규화했다. `source.json`에 CSV와 라이선스의 SHA-256을 기록했다.
빌더는 네트워크 없이 체크섬을 확인한 뒤 실행한다. 위 판의 vendor가 준비되어 있으면 별도 다운로드가 필요 없다.

생성 규칙과 예외는 `tools/build-names.mjs`, 소비자 API는 `names/README.md`에 있다.

`pokemon_species.csv`(같은 고정 커밋)는 포획률(`capture_rate`)용이다. `tools/build-catch-rates.mjs` 가 체크섬을 확인하고
`data/catch-rates.json`(도감 번호 → 포획률)을 만든다. Showdown 데이터에는 포획률이 없다.

`machines.csv`·`item_flavor_text.ko.csv`(같은 고정 커밋)는 배틀 밖 도구용이다. `tools/build-items-outside.mjs` 가
9세대(스칼렛·바이올렛, version_group 25) 기술머신 번호 → 기술과 가방 설명(한국어 최신 판)을 `data/items-outside.json` 으로 만들고,
`tools/build-names.mjs` 가 기술머신 이름(`기술머신001`)을 이름표에 더한다. 원본 `item_flavor_text.csv` 는 6MB 라 한국어(`language_id=3`) 행 중
도구마다 가장 최근 판 한 줄만 남겼다 (규칙과 원본 체크섬은 `source.json` 의 `derived`). 같은 규칙으로 영어(`language_id=9`) 줄만 남긴
`item_flavor_text.en.csv` 는 같은 도구들의 영어 공식 설명용이다.

`pokemon_stats.csv`(같은 고정 커밋)는 노력치(기초포인트) 지급량(`effort` 열)용이다. Showdown·PokeRogue 데이터에는 없다.
`tools/build-exp.mjs` 가 체크섬을 확인하고 `pokemon.csv` 로 종·폼을 맞춰 `data/exp.json` 의 `effort`(전국도감 번호 → 기본 폼 지급량 6자리,
`effortStats` 차례 hp·atk·def·spa·spd·spe — PokeAPI `stats.csv` 의 stat id 1~6)와 `effortForms`(기본 폼과 다른 폼만, Showdown 종 id)를 만든다.
번호·이름·종족값이 Showdown 과 같은 것만 짝짓고, 지급량이 모두 0 인 폼(PokeAPI 에 값이 아직 없는 새 메가 등)은 기본 폼 값을 쓴다. 손으로 넣은 값은 없다.

`pokeapi-dex/` (지방 도감 번호, 0.0.7): PokeAPI `pokedexes.csv`·`pokemon_dex_numbers.csv` 를 **다른 고정 커밋** `8a92bfa7dab2f12b84b5d151562f9857c133ff30`(2026-11-13 master — Legends Z-A 의 미르·이차원 도감이 있는 판)에서 받아 둔다.
`node tools/build-dex-lists.mjs --fetch` 가 받고 체크섬을 `pokeapi-dex/source.json` 에 적는다. `--fetch` 없이는 네트워크 없이 체크섬만 확인하고 `data/dex-lists.json` 을 만든다 (story/dex.mjs 가 읽음).

`items.csv`(같은 고정 커밋 `2bf639e5…`, 0.0.8 가게)는 도구 값(`cost` 열 — 가게에서 사는 값)용이다. `tools/build-shop.mjs` 가 체크섬을 확인하고
가게가 파는 도구의 값과 진열 목록을 `data/shop.json` 으로 만든다. 값이 0 인 도구는 정한 값(`fixedPrice`)을 쓰고 `fixed` 에 적는다. 손으로 넣은 값은 없다.
`item_game_indices.csv`(같은 고정 커밋, 0.1.0)는 Showdown 이 모르는 가게 도구가 처음 나온 세대(`data/shop.json since`)용이다.
`game-prices.json`(0.1.0)은 원작 게임 상점 자료다: 게임(디스크 규격)마다 돈으로 파는 생활 물건의 값(1~4세대 pret 디컴파일, 그 뒤는 Bulbapedia·Serebii),
돈으로 파는 기술머신(기술과 값), 마을 명물을 파는 게임. `tools/build-shop.mjs` 가 읽어 `data/shop.json games` 를 만든다.

`fishing/` (낚시, 0.0.9): `tools/build-fishing.mjs --fetch` 가 PokeAPI 같은 고정 커밋 `2bf639e5…` 의 만남 자료와 PKHeX `6c958388…` 의 장소 이름 글(영어·한국어 줄,
게임 글 — 이름만 쓰고 코드는 가져오지 않음)을 받아 둔다. 큰 두 파일(`encounters.csv` 3.2MB, `encounter_condition_value_map.csv` 1.1MB)은 낚시 줄만 남겼고
(`location_names.csv` 는 영어 줄만), 규칙과 원본 체크섬은 `fishing/source.json` 의 `derived` 에 있다. `--fetch` 없이는 네트워크 없이 체크섬만 확인하고
`data/fishing.json` 을 만든다 (`story/fishing.mjs` 가 읽음). 종족값·진화 단계는 Showdown Dex, 포획률은 `pokeapi/pokemon_species.csv`.

`pokeapi-item-files.json` (도구 그림, 0.0.9): PokeRogue 도구 그림이 없는 가방 도구는 PokeAPI 도구 그림(`sprites/items/<파일>.png`, 포켓몬·배지 그림과 **같은 고정 커밋**
`1dd55c04…`)을 플레이 때 받아 그린다 — 저장소에는 넣지 않는다. `tools/build-pokeapi-items.mjs` 가 `pokeapi/items.csv`·`item_names.csv` 로 도구 id → PokeAPI 파일 이름
(영어 이름 기준 — 깃털은 PokeAPI 의 옛 `*-wing`, Z크리스탈은 `--bag` 큰 그림)을 정해 `data/pokeapi-item-map.json` 을 만든다. 그 커밋에 파일이 있는지는
`--fetch` 가 후보마다 HEAD 로 물어 이 파일에 적고, `--fetch` 없이는 네트워크 없이 이 목록만 본다. 손으로 넣은 이름은 없다.

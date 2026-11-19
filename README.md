# PokéTale

A RisuAI plugin for Pokémon battles inside chat. The interface and battle text are in Korean.

## Install

Import [`dist/poke-battle.js`](dist/poke-battle.js) in RisuAI's plugin settings. A RisuAI version supporting plugin API 3.0 is required. Grant the requested permissions and open the PokéTale settings to select the bots it runs for.

Version 0.0.8 requests RisuAI's request-replacement permission to refresh party and bag information immediately before sending a regenerated reply. RisuAI asks again every three days and when the version changes. Declining keeps the previous behavior.

After installing this file once, future versions can be installed with RisuAI's plugin update control. Updates are downloaded from this repository's main branch.

Images and sounds are loaded at runtime from PokeRogue assets and PokéAPI Pokémon and badge sprites on `raw.githubusercontent.com`, and from `play.pokemonshowdown.com`. The plugin has no server of its own.

Pokémon can say their names in the PokéPark 2 voices: load the voice zips from The Sounds Resource in the settings as downloaded, without unpacking them. The game's file names tell whose line each file is (`data/pokepark2-voices.json`, read out of PokéPark 2's sound banks and scripts), which also mends the few lines the "Miscellaneous Voices" zip files under another Pokémon's folder; other zips are read by folders named after each Pokémon. Several zips can be loaded; the one higher in the list is used first. A Pokémon says the line the game itself plays at that moment — its greeting when it appears, its hurt cry when it faints, its battle shout in a move, its happy line when pleased. Where the zip lacks the game's line for that moment, it says the kind of line most Pokémon use then, and a random one when even that is missing; Pokémon in no zip keep the game cries. The voices are kept in RisuAI's plugin storage in parts, so a battle reads only those of the Pokémon in it. PokéTale neither includes nor downloads any of them.

## Build

Requirements: Node.js 24 or later, npm and Git. On Windows, run from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File tools/fetch-vendor.ps1
npm run build
```

On Linux or macOS:

```sh
bash tools/fetch-vendor.sh
npm run build
```

The fetch script prepares the pinned upstream sources and installs dependencies. The build generates the required data and writes `dist/poke-battle.js`. To install only this project's locked dependencies after vendor sources are present, use `npm ci`.

Regenerating changed font subsets requires Python with `fonttools` and `brotli`. Normal builds use the included subsets when the required characters have not changed.

## License and credits

This project is licensed under **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**; see [LICENSE](LICENSE). Third-party code, data, fonts and runtime assets retain their applicable licenses. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [PokeRogue adaptation notices](view/LICENSE-NOTE.md).

Pokémon and Pokémon character names are trademarks of Nintendo. Pokémon © Nintendo, Creatures Inc., GAME FREAK inc. This is an unofficial fan project and is not affiliated with or endorsed by those companies, The Pokémon Company, Pokémon Showdown or PokeRogue.

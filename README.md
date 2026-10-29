# PokéTale

A RisuAI plugin for Pokémon battles inside chat. The interface and battle text are in Korean.

## Install

Import [`dist/poke-battle.js`](dist/poke-battle.js) in RisuAI's plugin settings. A RisuAI version supporting plugin API 3.0 is required. Grant the requested permissions and open the PokéTale settings to select the bots it runs for.

After installing this file once, future versions can be installed with RisuAI's plugin update control. Updates are downloaded from this repository's main branch.

Images and sounds are loaded at runtime from `raw.githubusercontent.com` and `play.pokemonshowdown.com`. The plugin has no server of its own.

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

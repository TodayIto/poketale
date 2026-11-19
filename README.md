# PokéTale

A RisuAI plugin for Pokémon battles inside chat. The interface and battle text are in Korean.

## Install

Import [`dist/poke-battle.js`](dist/poke-battle.js) in RisuAI's plugin settings. A RisuAI version supporting plugin API 3.0 is required. Grant the requested permissions and open the PokéTale settings to select the bots it runs for.

Version 0.0.8 requests RisuAI's request-replacement permission to refresh party and bag information immediately before sending a regenerated reply. RisuAI asks again every three days and when the version changes. Declining keeps the previous behavior.

After installing this file once, future versions can be installed with RisuAI's plugin update control. Updates are downloaded from this repository's main branch.

Images and sounds are loaded at runtime from PokeRogue assets and PokéAPI Pokémon, badge and item sprites on `raw.githubusercontent.com`, and from `play.pokemonshowdown.com`. The plugin has no server of its own.

## Device preferences and cry packs

Panel preferences are stored on this device through RisuAI's safe local storage. Cry packs are stored on this device through RisuAI's local plugin storage; neither stores story or chat state. If device storage is unavailable, preferences use the shared settings and imported cry packs remain available for the current page only.

To use a cry pack, download a ZIP from [The Sounds Resource — PokéPark 2](https://sounds.spriters-resource.com/wii/pokepark2wondersbeyond) yourself and import it under Settings > Sound. Matching scenes use the pack's voice clips instead of the normal cry. Audio files are not included with this plugin.

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

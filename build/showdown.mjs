import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const dist = realpathSync(fileURLToPath(new URL('../vendor/pokemon-showdown/dist', import.meta.url)));
const tables = {
  Abilities: 'abilities', Rulesets: 'rulesets', FormatsData: 'formats-data', Items: 'items',
  Moves: 'moves', Natures: 'natures', Pokedex: 'pokedex', Scripts: 'scripts',
  Conditions: 'conditions', TypeChart: 'typechart',
};

export function showdownMods() {
  const mods = new Set();
  function visit(mod) {
    if (mod === 'base' || mod === 'gen9') return;
    if (mods.has(mod)) throw new Error(`Circular Showdown inheritance: ${mod}`);
    mods.add(mod);
    const { Scripts } = require(join(dist, 'data/mods', mod, 'scripts.js'));
    visit(Scripts.inherit || 'base');
  }
  visit('champions');
  return [...mods];
}

export const DROPPED_FIELDS = {
  Pokedex: ['color', 'eggGroups', 'heightm', 'formeOrder', 'canHatch'],
  Moves: ['contestType'],
  FormatsData: ['tier', 'natDexTier', 'doublesTier'],
  Rulesets: ['onValidateSet', 'onValidateTeam', 'onChangeSet', 'checkCanLearn'],
};

function literal(value) {
  if (typeof value === 'function') return value.toString();
  if (Array.isArray(value)) return `[${value.map(literal).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, v]) => property(key, v)).join(',')}}`;
  return value === undefined ? 'void 0' : JSON.stringify(value);
}
function property(key, value) {
  const source = typeof value === 'function' && value.toString();

  if (source && (source.startsWith(`${key}(`) || source.startsWith(`async ${key}(`))) return source;
  return `${JSON.stringify(key)}:${literal(value)}`;
}

// ES module text of one data file (path)'s table (type) with DROPPED_FIELDS removed
export function slimTableSource(path, type) {
  const drop = new Set(DROPPED_FIELDS[type]);

  const module = { exports: {} };
  runInNewContext(readFileSync(path, 'utf8'), { module, exports: module.exports }, { filename: path });
  const table = Object.fromEntries(Object.entries(module.exports[type])
    .map(([id, entry]) => [id, Object.fromEntries(Object.entries(entry).filter(([field]) => !drop.has(field)))]));
  return `export const ${type} = ${literal(table)};`;
}

function replaceOnce(source, needle, replacement, file) {
  const matches = typeof needle === 'string' ? source.split(needle).length - 1 : [...source.matchAll(new RegExp(needle.source, 'g'))].length;
  if (matches !== 1) throw new Error(`Upstream adapter mismatch: ${file}: ${needle} (${matches})`);
  return source.replace(needle, replacement);
}

export const showdownBrowser = {
  name: 'showdown-browser',
  setup(b) {
    const mods = showdownMods();
    b.onResolve({ filter: /^showdown:static-data$/ }, () => ({ path: 'data', namespace: 'showdown-static' }));
    b.onLoad({ filter: /.*/, namespace: 'showdown-static' }, () => {
      const imports = [], entries = [];
      for (const mod of ['base', ...mods]) {
        const fields = ['Learnsets: {}', 'PokemonGoData: {}'];
        for (const [type, file] of Object.entries(tables)) {
          const path = join(dist, 'data', mod === 'base' ? '' : `mods/${mod}`, `${file}.js`);
          if (!existsSync(path)) continue;
          const id = `data${imports.length}`;
          imports.push(`import { ${type} as ${id} } from ${JSON.stringify(path)};`);
          fields.push(`${type}: ${id}`);
        }
        entries.push(`${JSON.stringify(mod)}: {${fields.join(',')}}`);
      }
      return { contents: `${imports.join('\n')}\nexport const data = {${entries.join(',')}};`, loader: 'js', resolveDir: dist };
    });

    const slim = new Map(Object.keys(DROPPED_FIELDS).map(type => [tables[type], type]));
    b.onLoad({ filter: /[/\\]dist[/\\]data[/\\](mods[/\\][\w-]+[/\\])?[\w-]+\.js$/ }, a => {
      const type = slim.get(a.path.split(/[/\\]/).at(-1).slice(0, -3));
      if (!type || (!a.path.startsWith(dist + '/') && !a.path.startsWith(dist + '\\'))) return;
      return { contents: slimTableSource(a.path, type), loader: 'js' };
    });
    b.onLoad({ filter: /[/\\]dist[/\\]sim[/\\](dex|dex-formats|dex-text|dex-species|teams|prng)\.js$/ }, a => {

      if (!a.path.startsWith(dist + '/') && !a.path.startsWith(dist + '\\')) return;
      const file = a.path.split(/[/\\]/).at(-1);
      let source = readFileSync(a.path, 'utf8');
      const patch = (needle, replacement) => { source = replaceOnce(source, needle, replacement, file); };
      if (file === 'dex.js') {
        patch('var fs = __toESM(require("fs"));', 'var browserData = require("showdown:static-data").data;');
        patch('var path = __toESM(require("path"));', '');
        patch('const DATA_DIR = path.resolve(__dirname, "../data");', 'const DATA_DIR = "base";');
        patch('const MODS_DIR = path.resolve(DATA_DIR, "./mods");', 'const MODS_DIR = "mods";');
        patch(/  loadDataFile\(basePath, dataType\) \{[\s\S]*?\n  loadTextFile\(/,
          '  loadDataFile(basePath, dataType) {\n    return browserData[this.currentMod]?.[dataType];\n  }\n  loadTextFile(');
        patch('fs.readdirSync(MODS_DIR)', JSON.stringify(mods));
        patch('require(path.resolve(DATA_DIR, "aliases"))', 'require("../data/aliases")');
      } else if (file === 'dex-formats.js') {

        const formats = readFileSync(join(dist, 'config/formats.js'), 'utf8');
        const selected = [...formats.matchAll(/\n  \{\n[\s\S]*?\n  \},?/g)]
          .map(m => m[0].trim().replace(/,$/, ''))
          .filter(s => /name: "\[Gen 9(?: Champions)?\] (?:Doubles )?Custom Game"/.test(s));
        if (selected.length !== 4) throw new Error('Expected the upstream singles and doubles custom games (Gen 9, Gen 9 Champions)');
        patch(/    let customFormats;[\s\S]*?    let section = "";/,
          `    const Formats = [${selected.join(',')}];\n    let section = "";`);
      } else if (file === 'dex-text.js') {

        patch('var path = __toESM(require("path"));', '');
        patch('const TEXT_DIR = path.resolve(__dirname, "../data/text");', '');
        patch(/  static loadTextFile\(name, exportName, optional = false\) \{[\s\S]*?\n  static loadRawTextData\(/,
          '  static loadTextFile(name, exportName, optional = false) { return {}; }\n  static loadRawTextData(');
      } else if (file === 'teams.js') {
        patch(/  getGenerator\(format, seed = null\) \{[\s\S]*?\n  generate\(/,
          '  getGenerator(format, seed = null) { throw new Error("Random team generation is not bundled; supply a story team"); }\n  generate(');
      } else if (file === 'prng.js') {
        patch('if (typeof crypto === "undefined") globalThis.crypto = require("node:crypto");',
          'if (typeof crypto === "undefined") throw new Error("Web Crypto is required for an unseeded battle");');
      } else if (file === 'dex-species.js') {

        // Optional identity-sharing optimization only. Keep each mod's equal Species object separate.
        patch('var import_node_util = require("node:util");', '');
        patch(/      if \(this.dex.parentMod\) \{[\s\S]*?\n      \}\n    \} else \{/,
          '    } else {');
      }
      return { contents: source, loader: 'js', resolveDir: dirname(a.path) };
    });
  },
};

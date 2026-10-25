// Genera src/data/pokemon-names.json (número de Pokédex -> nombre en inglés y español) desde los CSV de PokeAPI.
// Uso: node scripts/build-pokemon-names.mjs   (solo hace falta cuando salgan Pokémon nuevos)
import { writeFile } from 'node:fs/promises';

const URL_CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv';
const LANG = { 9: 'en', 7: 'es' };

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const out = {};
for (const line of (await res.text()).split('\n').slice(1)) {
  const [id, lang, name] = line.split(',');
  const key = LANG[lang];
  if (!key || !name) continue;
  (out[id] ??= {})[key] = name;
}
const file = new URL('../src/data/pokemon-names.json', import.meta.url);
await writeFile(file, JSON.stringify({ source: URL_CSV, names: out }) + '\n');
console.log(`${Object.keys(out).length} especies`);

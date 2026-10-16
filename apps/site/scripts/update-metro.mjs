// Rebuilds src/lib/stores/metro.json from the open hh.ru metro directory (metro, МЦК, МЦД).
// Station ids (`<line>.<station>`) are stored in "marketStore".metro, so stations that hh.ru
// temporarily drops are kept from the previous file instead of disappearing.
import { readFile, writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../src/lib/stores/metro.json', import.meta.url);
const CITY_IDS = {
  'Москва': 'moscow', 'Санкт-Петербург': 'saint-petersburg', 'Екатеринбург': 'yekaterinburg', 'Казань': 'kazan',
  'Нижний Новгород': 'nizhny-novgorod', 'Новосибирск': 'novosibirsk', 'Самара': 'samara',
};
// hh.ru has no coordinates for these legacy ids; positions of the station entrances.
const FALLBACK = {
  '97.603': [55.749201, 37.538571], '95.537': [55.747189, 37.532375],
  '97.602': [55.757456, 37.526061], '95.538': [55.757456, 37.526061],
};
const round = value => Math.round(value * 1e6) / 1e6;

const response = await fetch('https://api.hh.ru/metro', { headers: { 'User-Agent': 'canrush.ru metro updater' } });
if (!response.ok) throw new Error(`api.hh.ru/metro: HTTP ${response.status}`);
const cities = await response.json();
const previous = JSON.parse(await readFile(OUTPUT, 'utf8'));
const result = {};
for (const city of cities) {
  const id = CITY_IDS[city.name];
  if (!id) continue;
  const stations = new Map();
  for (const line of city.lines) for (const station of line.stations) {
    if (typeof station.lat !== 'number' || typeof station.lng !== 'number') continue;
    stations.set(station.id, { id: station.id, name: station.name.trim(), line: line.name.trim(), color: `#${line.hex_color.toUpperCase()}`, lat: round(station.lat), lng: round(station.lng) });
  }
  for (const old of previous[id] ?? []) {
    if (stations.has(old.id)) continue;
    const point = old.lat !== undefined ? [old.lat, old.lng] : FALLBACK[old.id];
    if (!point) throw new Error(`No coordinates for kept station ${old.id} ${old.name}`);
    stations.set(old.id, { ...old, lat: point[0], lng: point[1] });
  }
  result[id] = [...stations.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.line.localeCompare(b.line, 'ru'));
}
for (const id of Object.keys(previous)) if (!result[id]) throw new Error(`hh.ru returned no stations for ${id}`);
const body = Object.entries(result).map(([id, list]) => `${JSON.stringify(id)}: [\n${list.map(station => `  ${JSON.stringify(station)}`).join(',\n')}\n]`);
await writeFile(OUTPUT, `{\n${body.join(',\n')}\n}\n`);
console.log(Object.entries(result).map(([id, list]) => `${id}: ${list.length}`).join(', '));

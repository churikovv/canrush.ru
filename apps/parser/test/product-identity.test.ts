import { describe, expect, it } from 'vitest';
import { isAssortmentFlavor, isExcludedEnergyBrand } from '@canrush/shared';
import { loadProductsConfig } from '../src/config.js';
import { normalizeProduct } from '../src/normalize.js';
import { groupByFlavor } from '../src/storage.js';
const config = loadProductsConfig();
function product(name: string, id = name) {
  return normalizeProduct('edadeal', { sourceId: id, name, brand: 'Red Bull', price: 100, url: 'https://example.com', imageUrl: `https://example.com/${id}.jpg` }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases);
}
describe('product identity across cities', () => {
  it('separates original, tropical and sugarfree instead of pooling unknown offers', () => {
    const groups = groupByFlavor([
      product('Энергетический напиток Red Bull 0,355л'),
      product('Red Bull Ред Булл тропические фрукты, 355мл'),
      product('Red Bull Tropical Edition 250 мл'),
      product('Red Bull без сахара 250 мл'),
      product('RED BULL Sugarfree газированный 0.25л'),
    ]);
    expect(groups.map(group => group.flavor).sort()).toEqual(['original', 'sugarfree', 'tropical']);
    expect(groups.find(group => group.flavor === 'tropical')?.variants).toHaveLength(2);
    expect(groups.find(group => group.flavor === 'sugarfree')?.variants).toHaveLength(2);
  });
  it('gives unresolved offers stable distinct identities, independent of city ordering', () => {
    const a = product('Red Bull Mystery Edition', 'a'); const b = product('Red Bull Fruit Mix', 'b');
    const left = groupByFlavor([a, b]); const right = groupByFlavor([b, a]);
    expect(left).toHaveLength(2);
    expect(left[0]?.flavor).toMatch(/^unresolved:/);
    expect(left[0]?.flavor).toBe(right[1]?.flavor);
    expect(left[0]?.flavor).not.toBe(left[1]?.flavor);
  });
  it('does not collapse mixtures or imported families into a single fruit edition', () => {
    expect(product('Red Bull Апельсин и Маракуйя').flavor).toBe('blend:orange+passion_fruit');
    expect(product('Red Bull ZERO ананас-лимон').flavor).toBe('blend:lemon+pineapple:sugarfree');
    expect(product('Red Bull Sods Zero Sugar Summer Berry').flavor).toBe('redbull_sods_summer_berry:sugarfree');
    expect(product('Red Bull Krating Daeng Extra Zinc').flavor).toBe('redbull_krating_daeng_extra_zinc');
    expect(product('Red Bull Coffee').flavor).toBe('coffee');
  });
});

describe('retailer brand aliases and named editions', () => {
  function offer(name: string, brand: string) {
    return normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases);
  }
  it('unifies retailer brand aliases, with explicit product names taking precedence', () => {
    expect(offer('Напиток энергетический Flash Up Energy 0.45л, 450 мл', 'Flesh').flavor).toBe('original');
    expect(offer('Volt Energy Манго-Лайм', 'Volt').brand).toBe('Volt Energy');
    expect(offer('Флэш Энергия банан фейхоа', 'Flesh').brand).toBe('Flash Up');
    expect(offer('Вольт 0.45 л ж б', 'Flash Up').brand).toBe('Volt Energy');
    expect(offer('Адреналин Раш 250мл', 'Adrenaline Game Fuel')).toMatchObject({ brand: 'Adrenaline Rush', flavor: 'original' });
  });
  it('groups the same named edition despite language, retailer brand and omitted flavor', () => {
    const a = offer('Adrenaline Rush Game Fuel 449 мл', 'Adrenaline');
    const b = offer('Адреналин Игровая Энергия со вкусом манго 0.449л', 'Adrenaline Game Fuel');
    expect(a.flavor).toBe('game_fuel');
    expect(groupByFlavor([a, b])).toHaveLength(1);
    expect(offer('Адреналин Экстра 449мл', 'Adrenaline').flavor).toBe('extra');
    expect(offer('Adrenaline Rush Breeze Energy 449мл', 'Adrenaline').flavor).toBe('breeze');
    expect(offer('Adrenaline Rush Silver Energy без сахара 449мл', 'Adrenaline Gold').flavor).toBe('sugarfree');
  });
  it('does not collapse unknown editions or assorted packs into original', () => {
    for (const name of ['Adrenaline Future Edition 449мл', 'Adrenaline в ассортименте 449мл', 'Volt со вкусом чего-то нового']) {
      expect(offer(name, 'Adrenaline').flavor).toBeUndefined();
    }
    expect(offer('Flash Up Game Mode XP 450 мл', 'Fresh up').flavor).not.toBe(offer('Flash Up Game Mode MP 450 мл', 'Flesh').flavor);
  });
});

it('recognizes Tornado editions, including retailer typos, without guessing their flavor', () => {
  const normalize = (name: string) => normalizeProduct('edadeal', { sourceId: name, name, brand: 'Tornado', price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases);
  for (const [names, flavor] of [
    [['Tornado Max Energy Black', 'Торнадо Блэк тропические фрукты'], 'tornado_black'],
    [['Tornado Max Storm', 'Торнадо Шторм классический'], 'tornado_storm'],
    [['Tornado Asian Mix', 'Tornado Energi Asiam mix'], 'tornado_asian_mix'],
    [['Tornado Razzberry', 'Tornado Razbery'], 'tornado_razzberry'],
    [['Tornado Bubble', 'Торнадо Баббл'], 'tornado_bubble'],
    [['Tornado Boost', 'Tornado Tornadoboost'], 'tornado_boost'],
    [['Tornado Sour & Marm'], 'tornado_sour_marm'],
  ] as Array<[string[], string]>) {
    const products = names.map(normalize);
    expect(products.every(product => product.flavor === flavor)).toBe(true);
    expect(groupByFlavor(products)).toHaveLength(1);
  }
  expect(normalize('Tornado Original').flavor).toBe('original');
  expect(normalize('Tornado неизвестная версия').flavor).toBeUndefined();
});

it('keeps named editions distinct for Burn, Gorilla, Cosmos, Aziano and Target', () => {
  const normalize = (brand: string, name: string) => normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases);
  for (const [brand, name, flavor] of [
    ['Burn', 'Напиток энергетический Бёрн 0,449л', 'original'],
    ['Burn', 'Burn Сочная энергия 449мл', 'burn_juicy'],
    ['Burn', 'Бёрн Тёмная энергия', 'burn_dark'],
    ['Burn', 'Burn Gold Rush', 'burn_gold_rush'],
    ['Burn', 'Burn персик манго Зеро', 'blend:mango+peach:sugarfree'],
    ['Gorilla', 'Gorilla Green Boost', 'gorilla_green_boost'],
    ['Gorilla', 'Горилла Берри Бласт', 'gorilla_berry_blast'],
    ['Gorilla', 'Gorilla Berry Bloom', 'gorilla_berry_bloom'],
    ['Gorilla', 'Gorilla Zero Sugar 450мл', 'sugarfree'],
    ['Cosmos', 'Космос Дерзкая энергия', 'cosmos_bold'],
    ['Cosmos', 'Cosmos Яркая энергия', 'cosmos_bright'],
    ['Aziano', 'Aziano Energy Fly', 'aziano_fly'],
    ['Aziano', 'Aziano Energy Power', 'aziano_power'],
    ['Target', 'TARGET ACTIVE 500 мл', 'target_active'],
  ]) {
    expect(normalize(brand!, name!).flavor).toBe(flavor);
  }
  expect(normalize('Красная птица АШАН', 'Напиток энергетический АШАН Красная птица газированный 500мл').flavor).toBeUndefined();
  expect(normalize('Gorilla', 'GORILLA в ассортименте 0,45л').flavor).toBeUndefined();
});

it('recognizes the reported regional product editions without merging ambiguous assortments', () => {
  const cases: Array<[string, string, string | undefined]> = [
    ['Tassay', 'Напиток энергетический Tassay Energy 0.45л, 450 мл', 'original'],
    ['Vulkan', 'Напиток энергетический Vulkan без сахара, 450 мл', 'sugarfree'],
    ['Drive Me', 'Напиток Drive Me Max газированный, 449мл', 'drive_max'],
    ['Drive Me', 'Напиток энергетический Drive Me, 449 мл', 'original'],
    ['Pulseup', 'Энергетический Напиток Pulseup Energy 0,45л Ж/б', 'pulse_your'],
    ['Pulseup', 'Pulseup Prosecco Energy 0,45л', 'pulse_prosecco'],
    ['Pulseup', 'PulseUp Frozen Energy 330мл', 'pulse_frozen'],
    ['Fun Up', 'FUN UP Guarana 450мл', 'guarana'],
    ['Jaguar', 'Jaguar Free, 500 мл, банка', 'jaguar_free'],
    ['Genesis', 'Genesis Green Star 450л', 'genesis_green'],
    ['Genesis', 'Genesis Фиолетовая звезда 0.5 л', 'genesis_purple'],
    ['Gorilla', 'Gorilla Sugar Free газированный в ассортименте', undefined],
    ['Jaguar', 'Jaguar Extra Urban Energy 440 мл', undefined],
    ['Drive Me', 'Drive Me Max Caramel Lollypop 449мл', 'drive_caramel'],
  ];
  for (const [brand, name, flavor] of cases) {
    expect(normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases).flavor).toBe(flavor);
  }
});

it('separates Monster editions while unifying retailer spelling and optional sugar-free descriptions', () => {
  const normalize = (name: string, brand = 'Monster') => normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases);
  const variants: Array<[string[], string]> = [
    [['Monster Ultra White', 'Monster Ultra Zero White без сахара', 'Монстр Ультра Вайт Зеро'], 'monster_ultra_white'],
    [['Monster Ultra Paradice', 'Monster Ultra Paradise БЕЗ САХАРА'], 'monster_ultra_paradise'],
    [['Monster Mango Loco', 'Monster Mango Loko со вкусом манго'], 'monster_mango_loco'],
    [['Monster Monarch', 'Monster Monarch персик и нектарин'], 'monster_monarch'],
    [['Monster Pipeline Punch', 'Monster Pipeline Punch тропические фрукты'], 'monster_pipeline_punch'],
    [['Monster Nitro Cosmic Peach', 'Монстр Нитро Космик Перс'], 'monster_nitro_cosmic_peach'],
    [['Monster Aussie Limonade', 'Monster Aussie Lemonade лимон лайм'], 'monster_aussie_lemonade'],
    [['Monster Energy Green', 'Напиток MONSTER Energy газированный 0.5л'], 'original'],
  ];
  for (const [names, flavor] of variants) {
    expect(names.map(name => normalize(name).flavor)).toEqual(names.map(() => flavor));
  }
  expect(normalize('Monster Ultra Fiesta Mango').flavor).not.toBe(normalize('Monster Mango Loco').flavor);
  expect(normalize('Monster Strawberry Shot').flavor).not.toBe(normalize('Monster Ultra Strawberry').flavor);
  expect(normalize('Monster Zero Sugar (Green Text)').flavor).toBe('sugarfree');
  expect(normalize('Monster Future Unknown Edition').flavor).toBeUndefined();
  expect(normalize('Ашкуdи Energy Belarus Apples by Voskresenskii', 'Energy')).toMatchObject({ brand: 'Ashkudi', flavor: 'ashkudi_belarus_apples' });
  expect(normalize('Ashkudi Energy Pomegranade', 'Energy')).toMatchObject({ brand: 'Ashkudi', flavor: 'pomegranate' });
  expect(normalize('TARGET ACTIVE 500 мл')).toMatchObject({ brand: 'Target', flavor: 'target_active' });
});

it('resolves additional named drinks but keeps assorted and unspecified Jaguar offers uncertain', () => {
  const cases: Array<[string, string, string | undefined]> = [
    ['Power Torr', 'POWER TORR Red Ягодно-фруктовый микс', 'power_torr_red'],
    ['Bacchus', 'Напиток негазированный Бахус 250мл', 'bacchus_still'],
    ['Bacchus', 'Напиток газированный Бахус 250мл', 'bacchus_sparkling'],
    ['Lit Energy', 'Lit Energy Granat 450мл', 'pomegranate'],
    ['Lit Energy', 'Lit Energy Turbo Zero 450мл', 'lit_turbo'],
    ['Lit Energy', 'Lit Energy Турбо 450мл', 'lit_turbo'],
    ['Doma By Guf', 'Doma By Guf Энергия 450мл', 'original'],
    ['Doma By Guf', 'Doma By Guf Ориджинал 450мл', 'original'],
    ['Dydo', 'Дайдо Вита Энерджи Желе 265,5 мл', 'dydo_vita_jelly'],
    ['Bizon', 'Bizon Energy Drink Black 449мл', 'bizon_black'],
    ['Energy', 'Scandalist Energy Drink Adder Terror 450мл', 'scandalist_adder_terror'],
    ['Energy', 'Scandalist Energy Drink Geneve 450мл', 'scandalist_geneve'],
    ['Go Champ', 'Go Champ Aperative Zero Sugar 450мл', 'go_champ_aperative:sugarfree'],
    ['Jaguar', 'Jaguar Extra Urban Energy 440мл', undefined],
    ['Adrenaline Rush', 'Adrenalin Rush в ассортименте 449мл', undefined],
    ['Drive Me', 'DRIVE ME в ассортименте 449мл', undefined],
  ];
  for (const [brand, name, flavor] of cases) {
    expect(normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-02', config.brandAliases, config.flavors, config.flavorAliases).flavor).toBe(flavor);
  }
});

describe('reviewed archive titles', () => {
  it.each([
    ['Lit Energy Клубничная жвачка 450 мл', 'blend:bubblegum+strawberry'],
    ['Lit Energy Turbo Zero 450 мл', 'lit_turbo'],
    ['Volt Ягодное драже 450 мл', 'berry_dragee'],
    ['Monster Energy Nitro со вкусом апельсина и лимона', 'monster_nitro'],
    ['Flash Up Zero Mode Peach Bilberry', 'blend:blueberry+peach:sugarfree'],
    ['Напиток энергетич.Ред Булл газ.0,25л ж/б', 'original'],
    ['Напиток энергетич.Ред Булл б/сахара газ.0,25л ж/б', 'sugarfree'],
  ])('recognizes %s', (name, expected) => expect(product(name).flavor).toBe(expected));
  it('keeps assortment unresolved', () => expect(product('Напиток энергетический ЛИТ ЭНЕРДЖИ в ассортименте').flavor).toBeUndefined());
});

it.each([
  ['RedBull Fruit Mix 325 мл', 'redbull_fruit_mix'],
  ['RedBull Krating m 250 мл', 'redbull_krating_daeng'],
  ['RedBull Krating Daeng Extra Zinc m стекло 145 мл', 'redbull_krating_daeng_extra_zinc'],
  ['Drive Me Экзотическая энергия луло-кактус 449 мл', 'blend:cactus+lulo'],
])('recognizes reviewed edition %s', (name, flavor) => expect(product(name).flavor).toBe(flavor));

it.each([
  ['Adrenaline Rush Vitamin Power Манго 449 мл', 'mango'],
  ['Adrenaline Vitamin Power со вкусом Апельсина 449 мл', 'orange'],
  ['Adrenaline Vitamin Power Ягодная энергия 449 мл', 'berry'],
  ['Adrenaline Rush Game Fuel Манго 449 мл', 'mango'],
])('keeps Vitamin Power editions distinct: %s', (name, flavor) => expect(product(name).flavor).toBe(flavor));

it('keeps Flash Zero Mode sugarfree even when a source omits that suffix', () => {
  expect(product('Flash Up Zero Mode Peach Bilberry 450 мл').flavor).toBe('blend:blueberry+peach:sugarfree');
});

it('recognizes October 2026 retailer titles and keeps assortment flyers and sodas out of the catalog', () => {
  const offer = (name: string, brand: string) => normalizeProduct('edadeal', { sourceId: name, name, brand, price: 100, url: 'https://example.com' }, config.brands, '2026-10-15', config.brandAliases, config.flavors, config.flavorAliases);
  expect(offer('Напиток энергетический Red Bull The Winter Edition Ледяные мармеладки газированный, 250мл, 250 мл', 'Red Bull').flavor).toBe('redbull_winter_ice_gummies');
  expect(offer('Напиток безалкогольный RED BULL Red Edition газированный, 0.25л', 'Red Bull').flavor).toBe('watermelon');
  expect(offer('Напиток Баста Гуф Мандариновый пуэр тонизирующий энергетический газированный, 450мл, 450 мл', 'Doma By Guf').flavor).toBe('doma_tangerine_puer');
  expect(offer('Напиток by Баста Мандариновый пуэр Баста Гуф тонизирующий энергетический газированный 450 мл', 'Doma By Guf').flavor).toBe('doma_tangerine_puer');
  expect(offer('Напиток энергетический сильногазированный Сангария Миракл, 500 мл, ж/б, Япония', 'Sangaria').flavor).toBe('sangaria_miracle');
  expect(offer('Напиток энергетический План Б Витаминная энергия б/а газ.0,45л ж/б', 'Plan B').flavor).toBe('plan_b_vitamin');
  expect(offer('Энергетический напиток WHITE SHARK, 150 мл', 'White')).toMatchObject({ brand: 'White Shark', flavor: 'original' });
  expect(offer('Напиток энергетический Carabao, 150 мл', 'Carabao').flavor).toBe('original');
  expect(offer('Напиток энергетический М-150, 150 мл', 'M-150').flavor).toBe('original');
  const flyers = [offer('НАПИТОК FLASH UP энергетический, в ассортименте, 0,45 л', 'Flash Up'), offer('НАПИТОК TORNADO MAX ENERGY энергетический, в ассортименте, 450 мл', 'Tornado')];
  expect(flyers.map(item => item.flavor)).toEqual([undefined, undefined]);
  expect(groupByFlavor([...flyers, offer('Напиток энергетический Carabao, 150 мл', 'Carabao')]).map(group => group.flavor)).toEqual(['original']);
  // Cards already published from such flyers are hidden as assortments.
  expect(isAssortmentFlavor('unresolved:31499aa17539fa00766c03c7') && isAssortmentFlavor('unresolved:5f313765398cc24a9275d081')).toBe(true);
  expect(isExcludedEnergyBrand('Dr. Pepper')).toBe(true);
});

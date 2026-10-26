import { monsterFlavor } from './monster-lines.js';
/** Named editions are product identities even when retailers omit their taste. */
export function namedProductFlavor(brand: string | undefined, name: string): string | undefined {
  if (brand === 'Pulse Up') brand = 'Pulseup';
  if (brand === 'Monster') return monsterFlavor(name);
  const rules: Record<string, Array<[RegExp, string]>> = {
    '100 Kwt': [[/raw energy/u, 'kwt_raw']],
    'Bacchus': [
      [/(?:^| )негазированный(?: |$)/u, 'bacchus_still'],
      [/(?:^| )газированный(?: |$)/u, 'bacchus_sparkling'],
    ],
    'Lit Energy': [[/клубничн.*жвач/u, 'blend:bubblegum+strawberry'], [/(?:granat|гранат)/u, 'pomegranate'], [/(?:turbo|турбо)/u, 'lit_turbo']],
    'Doma By Guf': [[/ориджинал/u, 'original']],
    // «Мандариновый пуэр» is a By Баста can («by БАСТА ГУФ» on it), even when the retailer files it under Guf.
    'By Баста': [[/(?:мандарин.*пуэр|пуэр.*мандарин)/u, 'basta_tangerine_puer'], [/(?:^| )(?:классический|ориджинал|original)(?: |$)/u, 'original']],
    'Sangaria': [[/(?:миракл|miracle)/u, 'sangaria_miracle']],
    // «Burn Energy» is a WOW Energy flavour (red-orange can), not the Burn brand.
    'Wow': [[/burn energy/u, 'wow_burn']],
    'Plan B': [[/витаминная энергия/u, 'plan_b_vitamin']],
    'Dydo': [[/вита энерджи желе/u, 'dydo_vita_jelly']],
    'Bizon': [[/(?:^| )black(?: |$)/u, 'bizon_black']],
    'Power Torr': [[/(?:^| )red(?: |$)/u, 'power_torr_red']],
    'Scandalist': [[/adder terror/u, 'scandalist_adder_terror'], [/geneve/u, 'scandalist_geneve']],
    'Go Champ': [[/aperative/u, 'go_champ_aperative']],
    // HQD Energy was renamed Ashkudi (Ашкуди) in 2025: the same cans, so both names land here.
    'Ashkudi': [
      [/(?:belarus apples|белорусск\S* яблоч)/u, 'ashkudi_belarus_apples'], [/pomegranade/u, 'pomegranate'],
      [/(?:golden bears|мармеладн\S* мишк)/u, 'ashkudi_golden_bears'], [/(?:sour|кисл\S* драже)/u, 'ashkudi_sour'],
      [/(?:pink lemonade|розов\S* лимонад)/u, 'ashkudi_pink_lemonade'], [/(?:dynamo|динамо)/u, 'ashkudi_dynamo'],
      [/(?:voltage|вольтаж)/u, 'ashkudi_voltage'], [/(?:surgut|сургутск)/u, 'blackcurrant'],
    ],
    'Red Bull': [[/(?:winter edition|ледяные мармеладки)/u, 'redbull_winter_ice_gummies'], [/(?:^| )red edition(?: |$)/u, 'watermelon'], [/krating.*extra.*zinc/u, 'redbull_krating_daeng_extra_zinc'], [/krating/u, 'redbull_krating_daeng'], [/fruit mix/u, 'redbull_fruit_mix'], [/sods.*summer berry/u, 'redbull_sods_summer_berry']],
    'Drive Me': [
      [/(?:caramel|сaramel|карамель).*(?:lollypop|лоллипоп)/u, 'drive_caramel'],
      [/bubble blast/u, 'drive_bubble'],
      [/(?:экзотическая энергия|экзот энергия)/u, 'drive_exotic'],
      [/(?:^| )(?:max|макс)(?: |$)/u, 'drive_max'],
      [/ориджинал/u, 'original'],
    ],
    'Pulseup': [
      [/frozen energy/u, 'pulse_frozen'],
      [/prosecco energy/u, 'pulse_prosecco'],
      [/(?:your energy|твоя энергия)/u, 'pulse_your'],
      [/(?:^| )(?:драйв|drive)(?: |$)/u, 'pulse_drive'],
    ],
    'Fun Up': [[/(?:guarana|гуарана)/u, 'guarana']],
    'Genesis': [
      [/(?:green star|зеленая звезда)/u, 'genesis_green'],
      [/(?:purple star|фиолетовая звезда)/u, 'genesis_purple'],
      [/(?:mystery star|мистическая звезда)/u, 'genesis_mystery'],
    ],
    'Jaguar': [
      [/(?:^| )(?:free|фри)(?: |$)/u, 'jaguar_free'],
      [/(?:^| )(?:cult|культ)(?: |$)/u, 'jaguar_cult'],
      [/(?:^| )(?:live|лайв)(?: |$)/u, 'jaguar_live'],
    ],
    'Burn': [
      [/(?:gold rush|голд раш)/u, 'burn_gold_rush'],
      [/сочная энергия/u, 'burn_juicy'],
      [/темная энергия/u, 'burn_dark'],
    ],
    'Cosmos': [
      [/дерзкая энергия/u, 'cosmos_bold'],
      [/яркая энергия/u, 'cosmos_bright'],
    ],
    'Aziano': [
      [/(?:^| )fly(?: |$)/u, 'aziano_fly'],
      [/(?:^| )power(?: |$)/u, 'aziano_power'],
    ],
    'Target': [[/(?:^| )active(?: |$)/u, 'target_active']],
    'Gorilla': [
      [/(?:green boost|грин буст|зеленый импульс)/u, 'gorilla_green_boost'],
      [/(?:ultimate|ультиматум|ультим[еэ]йт)/u, 'gorilla_ultimate'],
      [/(?:berry blast|берри бласт)/u, 'gorilla_berry_blast'],
      [/(?:berry bloom|берри блум)/u, 'gorilla_berry_bloom'],
      [/(?:tropical punch|тропикал punch)/u, 'tropical'],
      [/(?:^| )bananas(?: |$)/u, 'banana'],
      [/(?:^| )черри(?: |$)/u, 'cherry'],
    ],
    'Tornado': [
      [/(?:^| )(?:black|блэк)(?: |$)/u, 'tornado_black'],
      [/(?:^| )(?:storm|шторм)(?: |$)/u, 'tornado_storm'],
      [/(?:asian mix|asiam mix|азиатский микс)/u, 'tornado_asian_mix'],
      [/(?:^| )(?:bubble|babble|баббл|бабл)(?: |$)/u, 'tornado_bubble'],
      [/(?:^| )(?:razz?berry|razbery)(?: |$)/u, 'tornado_razzberry'],
      [/(?:^| )(?:russian|русский)(?: |$)/u, 'tornado_russian'],
      [/(?:^| )(?:boost|tornadoboost)(?: |$)/u, 'tornado_boost'],
      [/(?:^| )iceberry(?: |$)/u, 'tornado_iceberry'],
      [/(?:^| )active(?: |$)/u, 'tornado_active'],
      [/(?:^| )berrycream(?: |$)/u, 'tornado_berrycream'],
      [/(?:^| )sour marm(?: |$)/u, 'tornado_sour_marm'],
      [/(?:lemon ?cake|лемон ?кейк|лимонн\S* кекс)/u, 'tornado_lemoncake'],
    ],
    'Adrenaline Rush': [
      [/(?:vitamin\s*power|витаминная сила|game fuel).*(?:манго|mango)/u, 'mango'],
      [/(?:vitamin\s*power|витаминная сила).*(?:апельсин|orange)/u, 'orange'],
      [/(?:game fuel|г[еэ]йм фью[еэ]л|игровая энергия|игр энергия)/u, 'game_fuel'],
      [/(?:spicy|спайси|табаско)/u, 'spicy'],
      [/(?:breeze|бриз)/u, 'breeze'],
      [/(?:таинственная энергия|мистическая энергия|mystic energy)/u, 'mystery'],
      [/(?:extra|экстра)/u, 'extra'],
      [/(?:juicy|джуси|апельсиновая энергия)/u, 'orange'],
      [/(?:red energy|ред энерджи|рэд энерджи|ягодная энергия|ягодная|ягод| раш ред )/u, 'berry'],
      [/(?:юдзу|юзу).*(?:клуб|каламан)/u, 'blend:calamansi+strawberry+yuzu'],
    ],
    'Volt Energy': [
      [/ягодное драже/u, 'berry_dragee'],
      [/(?:сливов.*пирог)/u, 'plum_pie'],
      [/(?:попкорн|popcorn)/u, 'popcorn'],
    ],
    'Flash Up': [
      [/zero mode.*peach.*bilberry/u, 'blend:blueberry+peach'],
      [/(?:game mode|гейм мод|игровой режим).*(?:xp|хp|хр|икс пи|очки опыта)/u, 'game_mode_xp'],
      [/(?:game mode|гейм мод|игровой режим).*(?:mp|мп|эм пи|очки маны)/u, 'game_mode_mp'],
      [/(?:ultra|ультра)/u, 'ultra'],
      [/(?:bubble gum|баббл гам|бабл гам)/u, 'bubblegum'],
      [/(?:marshmallow|marhmallow|маршм[еэ]ллоу)/u, 'marshmallow'],
      [/(?:lemon waffle|лимон.*вафл)/u, 'lemon_waffle'],
      [/(?:черни.*(?:донат|пончик)|blueberry donut|блюберри донат)/u, 'blueberry_donut'],
    ],
  };
  return rules[brand ?? '']?.find(([pattern]) => pattern.test(name))?.[1];
}

export function isPlainOriginal(brand: string | undefined, name: string): boolean {
  const brands: Record<string, RegExp> = {
    'Doma By Guf': /doma by guf|дома бай гуф|энергия|energy/gu,
    // «Вакуленко В. М.» is the maker named in Ароматный мир titles.
    'By Баста': /byбаста|by баста|бай баста|баста|вакуленко|energy|drink|энерджи|дринк/gu,
    'Monster': /green text|monster|монстр|energy|энерджи|drink|green|grenn|зеленый|black/gu,
    'Tassay': /tassay|тассай|energy|энерджи/gu,
    'Vulkan': /vulkan|вулкан|energy|энерджи/gu,
    'Drive Me': /drive me|драйв ми|energy|drink/gu,
    'Pulseup': /pulseup|pulse up|пульсап|energy|энерджи/gu,
    'Burn': /burn|берн|energy|drink/gu,
    'Gorilla': /gorilla|горилла|energy|drink/gu,
    'Adrenaline Rush': /adrenaline?|адреналин|rush|раш|абсолютная|энергия|energy|power|silver|сильвер|серебряная|энержи|пепсико/gu,
    'Volt Energy': /volt|вольта?|energy|энергия|энерджи/gu,
    'Flash Up': /балтика|flash|фл[еэ]ш|up|ап|energy|энергия|энерджи|энержи|max|макс/gu,
    'Carabao': /carabao|карабао|energy|drink/gu,
    'M-150': /m 150|м 150|energy|drink/gu,
    'White Shark': /white shark|уайт шарк|energy|drink/gu,
  };
  const pattern = brands[brand ?? ''];
  if (!pattern || /(?:ассорт|ссорт|со вкусом|вкус)/u.test(name)) return false;
  // «энергетики» is a category label some retailers prefix; «энергитический» a common misspelling (Ароматный мир).
  const generic = new Set('нап м напиток энергетический энергетик энергетики энергитический энергет энергетич энерг безалкогольный безалк газированный сильногазированный газ тонизирующий тониз витаминизированный витамин ароматизированный пастеризованный вода в жестяной банке металлическая банка бан пэт ж б а п к л мл г шт x х с кофеином и таурином консервантов без сахара сах sugarfree sugar free zero зеро шугар'.split(' '));
  const remainder = name.replace(new RegExp(`(?:^| )(?:${pattern.source})(?= |$)`, 'gu'), ' ').replace(/\d+/gu, ' ').split(/\s+/u).filter(Boolean);
  return remainder.every(word => generic.has(word));
}

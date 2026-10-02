import { monsterFlavor } from './monster-lines.js';
/** Named editions are product identities even when retailers omit their taste. */
export function namedProductFlavor(brand: string | undefined, name: string): string | undefined {
  if (brand === 'Monster') return monsterFlavor(name);
  const rules: Record<string, Array<[RegExp, string]>> = {
    'Bacchus': [
      [/(?:^| )негазированный(?: |$)/u, 'bacchus_still'],
      [/(?:^| )газированный(?: |$)/u, 'bacchus_sparkling'],
    ],
    'Lit Energy': [[/(?:granat|гранат)/u, 'pomegranate'], [/(?:turbo|турбо)/u, 'lit_turbo']],
    'Doma By Guf': [[/ориджинал/u, 'original']],
    'Dydo': [[/вита энерджи желе/u, 'dydo_vita_jelly']],
    'Bizon': [[/(?:^| )black(?: |$)/u, 'bizon_black']],
    'Power Torr': [[/(?:^| )red(?: |$)/u, 'power_torr_red']],
    'Scandalist': [[/adder terror/u, 'scandalist_adder_terror'], [/geneve/u, 'scandalist_geneve']],
    'Go Champ': [[/aperative/u, 'go_champ_aperative']],
    'Ashkudi': [[/belarus apples/u, 'ashkudi_belarus_apples'], [/pomegranade/u, 'pomegranate']],
    'Red Bull': [[/sods.*summer berry/u, 'redbull_sods_summer_berry']],
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
    ],
    'Adrenaline Rush': [
      [/(?:game fuel|г[еэ]йм фью[еэ]л|игровая энергия|игр энергия)/u, 'game_fuel'],
      [/(?:spicy|спайси|табаско)/u, 'spicy'],
      [/(?:breeze|бриз)/u, 'breeze'],
      [/(?:таинственная энергия)/u, 'mystery'],
      [/(?:extra|экстра)/u, 'extra'],
      [/(?:juicy|джуси|апельсиновая энергия)/u, 'orange'],
      [/(?:vitamin power|витамин пауэр|red energy|ред энерджи|рэд энерджи|ягодная энергия| раш ред )/u, 'berry'],
      [/(?:юдзу|юзу).*(?:клуб|каламан)/u, 'blend:calamansi+strawberry+yuzu'],
    ],
    'Volt Energy': [
      [/(?:сливов.*пирог)/u, 'plum_pie'],
      [/(?:попкорн|popcorn)/u, 'popcorn'],
    ],
    'Flash Up': [
      [/(?:game mode|гейм мод|игровой режим).*(?:xp|хp|хр|икс пи|очки опыта)/u, 'game_mode_xp'],
      [/(?:game mode|гейм мод|игровой режим).*(?:mp|мп|эм пи|очки маны)/u, 'game_mode_mp'],
      [/(?:ultra|ультра)/u, 'ultra'],
      [/(?:bubble gum|баббл гам|бабл гам)/u, 'bubblegum'],
      [/(?:marshmallow|marhmallow|маршм[еэ]ллоу)/u, 'marshmallow'],
      [/(?:lemon waffle|лимон.*вафл)/u, 'lemon_waffle'],
      [/(?:черни.*(?:донат|пончик)|blueberry donut)/u, 'blueberry_donut'],
    ],
  };
  return rules[brand ?? '']?.find(([pattern]) => pattern.test(name))?.[1];
}

export function isPlainOriginal(brand: string | undefined, name: string): boolean {
  const brands: Record<string, RegExp> = {
    'Doma By Guf': /doma by guf|дома бай гуф|энергия|energy/gu,
    'Monster': /green text|monster|монстр|energy|энерджи|drink|green|grenn|зеленый|black/gu,
    'Tassay': /tassay|тассай|energy|энерджи/gu,
    'Vulkan': /vulkan|вулкан|energy|энерджи/gu,
    'Drive Me': /drive me|драйв ми|energy|drink/gu,
    'Pulseup': /pulseup|pulse up|пульсап|energy|энерджи/gu,
    'Burn': /burn|берн|energy|drink/gu,
    'Gorilla': /gorilla|горилла|energy|drink/gu,
    'Adrenaline Rush': /adrenaline?|адреналин|rush|раш|абсолютная|энергия|energy|power|silver|сильвер|серебряная|энержи|пепсико/gu,
    'Volt Energy': /volt|вольта?|energy|энергия|энерджи/gu,
    'Flash Up': /flash|фл[еэ]ш|up|ап|energy|энергия|энерджи|энержи|max|макс/gu,
  };
  const pattern = brands[brand ?? ''];
  if (!pattern || /(?:ассорт|ссорт|со вкусом|вкус)/u.test(name)) return false;
  const generic = new Set('напиток энергетический энергетик энергет энергетич энерг безалкогольный безалк газированный сильногазированный газ тонизирующий тониз витаминизированный витамин ароматизированный пастеризованный вода в жестяной банке металлическая банка бан пэт ж б а п к л мл г шт x х с кофеином и таурином консервантов без сахара сах sugarfree sugar free zero зеро шугар'.split(' '));
  const remainder = name.replace(new RegExp(`(?:^| )(?:${pattern.source})(?= |$)`, 'gu'), ' ').replace(/\d+/gu, ' ').split(/\s+/u).filter(Boolean);
  return remainder.every(word => generic.has(word));
}

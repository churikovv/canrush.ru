/** Edition names identify Monster products more precisely than a fruit mentioned in a title. */
export function monsterFlavor(name: string): string | undefined {
  const rules: Array<[RegExp, string]> = [
    [/(?:ultra|ультра).*(?:white|вайт)/u, 'monster_ultra_white'],
    [/(?:ultra|ультра).*(?:paradi[sc]e)/u, 'monster_ultra_paradise'],
    [/ultra.*violet/u, 'monster_ultra_violet'],
    [/ultra.*(?:black|biack)/u, 'monster_ultra_black'],
    [/ultra.*rosa/u, 'monster_ultra_rosa'],
    [/ultra.*strawberry/u, 'monster_ultra_strawberry'],
    [/ultra.*fiesta/u, 'monster_ultra_fiesta'],
    [/ultra.*golden.*pineapple/u, 'monster_ultra_golden_pineapple'],
    [/ultra.*watermelon/u, 'monster_ultra_watermelon'],
    [/ultra.*vice.*guava/u, 'monster_ultra_vice_guava'],
    [/ultra.*fantasy/u, 'monster_ultra_fantasy'],
    [/(?:mango lo[ck]o|манго локо)/u, 'monster_mango_loco'],
    [/(?:bad apple|бэд (?:эппл|яблоко))/u, 'monster_bad_apple'],
    [/(?:monarch|монарх)/u, 'monster_monarch'],
    [/pipeline punch/u, 'monster_pipeline_punch'],
    [/rio punch/u, 'monster_rio_punch'],
    [/(?:aussie l[ei]monade|оси стайл лэмонейд)/u, 'monster_aussie_lemonade'],
    [/(?:nitro cosmic peach|нитро космик перс)/u, 'monster_nitro_cosmic_peach'],
    [/(?:nitro|нитро)/u, 'monster_nitro'],
    [/rehab peach tea/u, 'monster_rehab_peach_tea'],
    [/the doctor/u, 'monster_the_doctor'],
    [/(?:vr ?46|вр46)/u, 'monster_vr46'],
    [/full throt{1,2}le/u, 'monster_full_throttle'],
    [/lando norris/u, 'monster_lando_norris'],
    [/khaotic/u, 'monster_khaotic'],
    [/strawberry shot/u, 'monster_strawberry_shot'],
    [/viking berry/u, 'monster_viking_berry'],
    [/absolute (?:zero|blu)/u, 'monster_absolute_zero'],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1];
}

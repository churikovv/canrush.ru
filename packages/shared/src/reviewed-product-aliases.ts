/** Historical identities verified against saved retailer titles and packaging. */
export const REVIEWED_PRODUCT_ALIASES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["Volt Energy", "orange", "Volt Energy", "blend:orange+passion_fruit"],
  ["Cosmos", "original", "Cosmos", "cosmos_bold"],
  ["Gorilla", "berry", "Gorilla", "gorilla_berry_blast"],
  ["Gorilla", "blueberry", "Gorilla", "gorilla_berry_bloom"],
  ["Gorilla", "coconut", "Gorilla", "blend:coconut+mango"],
  ["Pulse Up", "pulse_drive", "Pulseup", "pulse_drive"],
  ["Pulse Up", "pulse_your", "Pulseup", "pulse_your"],
  ["Pulseup", "original", "Pulseup", "pulse_your"],
  ["Pulse Up", "unresolved:b96f7fc42f5cae9f5a02852a", "Pulseup", "pulse_your"],
  ["Pulse Up", "unresolved:74cdeab3f536423357eee5dd", "Pulseup", "pulse_drive"],
  ["100 Kwt", "orange", "100 Kwt", "blend:grapefruit+orange"],
  ["100 Kwt", "grapefruit", "100 Kwt", "blend:grapefruit+orange"],
  ["100 Kwt", "unresolved:2a66d7b19eaab09e46d61017", "100 Kwt", "original"],
  ["100 Kwt", "unresolved:cd3221b1786a268cf5c1223d", "100 Kwt", "kwt_raw"],
  ["Jaguar", "kiwi", "Jaguar", "blend:cactus+kiwi"],
  ["Jaguar", "cactus", "Jaguar", "blend:cactus+kiwi"],
  ["Jaguar", "orange", "Jaguar", "blend:orange+passion_fruit"],
  ["Jaguar", "dragonfruit", "Jaguar", "blend:dragonfruit+guava"],
  ["Jaguar", "pineapple", "Jaguar", "blend:guava+peach+pineapple"],
  ["Jaguar", "unresolved:c5c5b1f41b859583c2766997", "Jaguar", "berry"],
  ["Jaguar", "unresolved:6ec9e88fe27fda61d4d700e5", "Jaguar", "berry"],
  ["Jaguar", "unresolved:89eea0013f5a74d684ce4a8e", "Jaguar", "original"],
  ["Vulkan", "mango", "Vulkan", "tropical"],
  ["Vulkan", "passion_fruit", "Vulkan", "tropical"],
  ["Vulkan", "raspberry", "Vulkan", "berry"],
  ["Flash Up", "blueberry", "Flash Up", "blueberry_donut"],
  ["Flesh", "blueberry", "Flash Up", "blueberry_donut"],
  ["Flesh", "original", "Flash Up", "blueberry_donut"],
  ["Flesh", "bubblegum", "Flash Up", "bubblegum"],
  ["Flash Up", "strawberry", "Flash Up", "bubblegum"],
  ["Flash Up", "blend:blueberry+peach", "Flash Up", "blend:blueberry+peach:sugarfree"],
  ["Adrenaline", "strawberry", "Adrenaline Rush", "blend:calamansi+strawberry+yuzu"],
  ["Adrenaline", "calamansi", "Adrenaline Rush", "blend:calamansi+strawberry+yuzu"],
  ["Adrenaline", "orange", "Adrenaline Rush", "orange"],
  ["Adrenaline", "original", "Adrenaline Rush", "berry"],
  ["Adrenaline", "berry", "Adrenaline Rush", "berry"],
  ["Adrenaline Rush", "strawberry", "Adrenaline Rush", "blend:calamansi+strawberry+yuzu"],
  ["Red Bull", "unresolved:029f4aa3f454b6d2504f7e19", "Red Bull", "redbull_fruit_mix"],
  ["Red Bull", "unresolved:b1e3a0f4d0b92c7c91553f3e", "Red Bull", "redbull_krating_daeng"],
  ["Red Bull", "unresolved:131fdbe09dfd5551820a2296", "Red Bull", "redbull_krating_daeng_extra_zinc"],
  ["Volt Energy", "cherry", "Volt Energy", "blend:cherry+cola"],
  ["Volt", "peach", "Volt Energy", "peach"],
  ["Volt", "blueberry", "Volt Energy", "blend:blueberry+pomegranate"],
  ["Volt", "plum", "Volt Energy", "plum_pie"],
  ["Drive Me", "mango", "Drive Me", "blend:guava+mango:sugarfree"],
  ["Drive Me", "blend:guava+mango", "Drive Me", "blend:guava+mango:sugarfree"],
  ["Drive Me", "cactus", "Drive Me", "blend:cactus+lulo"],
  ["Drive Me", "drive_exotic", "Drive Me", "blend:cactus+lulo"],
  ["Drive Me", "lime", "Drive Me", "citrus"],
  ["Drive Me", "strawberry", "Drive Me", "berry"],
  ["Байкал", "strawberry", "Байкал", "blend:cherry+strawberry"],
  ["Байкал", "blackcurrant", "Байкал", "blend:blackcurrant+raspberry"],
  ["Байкал", "lemon", "Байкал", "blend:coffee+lemon"],
  ["Adrenaline Rush", "unresolved:5eca7c37f5d01ff9d92f9821", "Adrenaline Rush", "berry"],
  ["Adrenaline Rush", "unresolved:0bbe22b23378cfc5f5ad0a2c", "Adrenaline Rush", "berry"],
  ["Adrenaline Rush", "pineapple", "Adrenaline Rush", "blend:pineapple+pomelo"],
  ["Adrenaline Rush", "calamansi", "Adrenaline Rush", "blend:calamansi+strawberry+yuzu"],
  ["Adrenaline Rush", "pomegranate", "Adrenaline Rush", "spicy"],
  ["Adrenaline Rush", "passion_fruit", "Adrenaline Rush", "passion_fruit:sugarfree"],
  ["Adrenaline Rush", "blend:mango+tropical", "Adrenaline Rush", "tropical"],
  ['Monster', 'strawberry', 'Monster', 'monster_ultra_strawberry'],
  ['Monster', 'strawberry:sugarfree', 'Monster', 'monster_ultra_strawberry'],
  ['Monster', 'orange', 'Monster', 'monster_nitro'],
  ...['mint', 'pomelo'].flatMap(flavor => ['Volt', 'Volt Energy'].map(brand => [brand, flavor, 'Volt Energy', 'blend:mint+pomelo'] as const)),
  ...['strawberry', 'grapefruit'].flatMap(flavor => ['Volt', 'Volt Energy'].map(brand => [brand, flavor, 'Volt Energy', 'blend:grapefruit+strawberry'] as const)),
  ...['Volt', 'Volt Energy'].map(brand => [brand, 'grape', 'Volt Energy', 'blend:grape+guava'] as const),
  ['Volt', 'mango', 'Volt Energy', 'blend:coconut+mango'],
  ['Volt Energy', 'coconut', 'Volt Energy', 'blend:coconut+mango'],
  ['Volt Energy', 'lime', 'Volt Energy', 'blend:lime+mango'],
  ['Volt', 'original', 'Volt Energy', 'berry_dragee'],
  ...['coconut', 'mango'].map(flavor => ['Lit Energy', flavor, 'Lit Energy', 'blend:coconut+mango'] as const),
  ...['bubblegum', 'strawberry', 'unresolved:f89ed28c6356c6b5a1037b4d', 'unresolved:40c07468378c5c2e3d3ec6c4'].map(flavor => ['Lit Energy', flavor, 'Lit Energy', 'blend:bubblegum+strawberry'] as const),
  ['Lit Energy', 'lit_turbo:sugarfree', 'Lit Energy', 'lit_turbo'],
  ['Lit Energy', 'peach', 'Lit Energy', 'blend:mango+peach'],
  ...['banana', 'feijoa'].map(flavor => ['Flash Up', flavor, 'Flash Up', 'blend:banana+feijoa'] as const),
  ['Flesh', 'mango', 'Flash Up', 'blend:mango+pineapple'],
  ['Flesh', 'peach', 'Flash Up', 'blend:blueberry+peach:sugarfree'],
  ...['peach', 'peach:sugarfree'].map(flavor => ['Flash Up', flavor, 'Flash Up', 'blend:blueberry+peach:sugarfree'] as const),
  ...['unresolved:f13c38bd33a9f9a227039acb', 'unresolved:6ebe4d3de09d180a6b47fb95'].map(flavor => ['Flash Up', flavor, 'Flash Up', 'original'] as const),
  ['Flash Up', 'unresolved:2279ecdd4b8973ce10e794ab', 'Flash Up', 'blueberry_donut'],
  ...['56309029a553e29e3d9c64d1', '8f903599828ec7c4ba5c7c9e', '75d6da7139783d6fcad07b6c', 'a7c07eb567bdeffecaa674c1', '50d33a1efcb146f5a2ed66af'].map(id => ['Red Bull', `unresolved:${id}`, 'Red Bull', 'original'] as const),
  ...['386f0d7bb336e65555044ddd', 'fb3c91b19ef226609d8a37b1'].map(id => ['Red Bull', `unresolved:${id}`, 'Red Bull', 'sugarfree'] as const),
  ['Red Bull', 'unresolved:6a738d5df477296f241eafcf', 'Red Bull', 'redbull_winter_ice_gummies'],
  ['Red Bull', 'unresolved:f6ab5fd1cd3a2b54599c05aa', 'Red Bull', 'watermelon'],
  ...['da30249c14de0adb913924fc', 'b9e32f17430fe6d77c37120e'].map(id => ['Doma By Guf', `unresolved:${id}`, 'By Баста', 'basta_tangerine_puer'] as const),
  ...['12c04198f8cb45dec71c17b2', 'ac4db0be477bb333af104606'].map(id => ['Sangaria', `unresolved:${id}`, 'Sangaria', 'sangaria_miracle'] as const),
  ['Plan B', 'unresolved:873f12c312f04ad672606e88', 'Plan B', 'plan_b_vitamin'],
  ['White', 'unresolved:567f71a9d9c21511e12d9538', 'White Shark', 'original'],
  ...['3f5fce95675e132ed823143a', 'dfd12677ae493a876b9a7859'].map(id => ['Carabao', `unresolved:${id}`, 'Carabao', 'original'] as const),
  ['M-150', 'unresolved:dffd1aae315ade30a7ce399e', 'M-150', 'original'],
  // Archived identities sharing the cover photo of a live product (duplicates in brand collections).
  ["Burn", "apple", "Burn", "blend:apple+kiwi"],
  ["Burn", "watermelon", "Burn", "watermelon:sugarfree"],
  ["Burn", "citrus", "Burn", "citrus:sugarfree"],
  ["Burn", "peach", "Burn", "blend:mango+peach:sugarfree"], // archived "Персик": its cover is the Peach Mango Zero Sugar 449 ml can
  ["Bizon", "original", "Bizon", "bizon_black"],
  ["Bizon", "mango", "Bizon", "blend:mango+passion_fruit"],
  ["Bizon", "passion_fruit", "Bizon", "blend:mango+passion_fruit"],
  ["Flash Up", "pineapple", "Flash Up", "blend:mango+pineapple"],
  ["Flash Up", "mint", "Flash Up", "blend:lime+mint"],
  ["Flash Up", "lime", "Flash Up", "blend:lime+mint"],
  ["Flash Up", "lemon", "Flash Up", "lemon_waffle"],
  ["Volt Energy", "feijoa", "Volt Energy", "blend:feijoa+kiwi"],
  ["Fitness Food Factory", "cherry", "Fitness Food Factory", "blend:cherry+cola:sugarfree"],
  ["Fitness Food Factory", "raspberry", "Fitness Food Factory", "blend:mint+raspberry"],
  ["Fitness Food Factory", "peach", "Fitness Food Factory", "blend:guava+peach"],
  ["Fitness Food Factory", "grapefruit", "Fitness Food Factory", "blend:grapefruit+mint"],
  ["Aziano", "original", "Aziano", "aziano_fly"],
  ["Ninja Star", "strawberry", "Ninja Star", "blend:strawberry+vanilla"],
  ["Ninja Star", "original", "Ninja Star", "cherry"],
  ["Bacchus", "original", "Bacchus", "bacchus_still"],
  ["Dydo", "original", "Dydo", "dydo_vita_jelly"],
  ["Wk Up", "peach", "Wk Up", "blend:guava+peach"],
  ["Wk Up", "cherry", "Wk Up", "blend:cherry+cola"],
  ["Wk Up", "raspberry", "Wk Up", "blend:mint+raspberry"],
  ["BOMBBAR", "raspberry", "BOMBBAR", "blend:kiwi+raspberry"],
  ["BOMBBAR", "lime", "BOMBBAR", "blend:lime+mint"],
  ["Genesis", "mango", "Genesis", "blend:lime+mango"],
  ["Genesis", "orange", "Genesis", "blend:orange+yuzu"],
  ["Genesis", "original", "Genesis", "genesis_mystery"],
  ["Alligator", "coconut", "Alligator", "blend:coconut+mango"],
  ["Alligator", "mango", "Alligator", "blend:coconut+mango"],
  ["Alligator", "lime", "Alligator", "blend:guava+lime+mint"],
  ["Alligator", "guava", "Alligator", "blend:guava+lime+mint"],
  ["Juster", "raspberry", "Juster", "blend:guava+raspberry"],
  ["Juster", "original", "Juster", "blend:calamansi+yuzu"],
  ["Juster", "calamansi", "Juster", "blend:calamansi+yuzu"],
  ["Black Rocket", "mango", "Black Rocket", "blend:apricot+mango"],
  ["Black Rocket", "apricot", "Black Rocket", "blend:apricot+mango"],
  ["My Rules", "mango", "My Rules", "blend:mango+passion_fruit"],
  ["My Rules", "passion_fruit", "My Rules", "blend:mango+passion_fruit"],
  ["Ninja", "original", "Ninja", "grape"],
  ["Sangaria", "original", "Sangaria", "sangaria_miracle"],
  ["Arizona", "original", "Arizona", "watermelon"],
  ["Target", "apple", "Target", "blend:apple+kiwi"],
  ["By Баста", "orange", "By Баста", "blend:grapefruit+lemon+orange"],
  ["By Баста", "grapefruit", "By Баста", "blend:grapefruit+lemon+orange"],
  ["By Баста", "barberry", "By Баста", "blend:barberry+pomegranate"],
  ["X-Turbo", "raspberry", "X-Turbo", "blend:berry+raspberry"],
  ["Quantum", "lime", "Quantum", "blend:lime+mint"],
  ["Rocket", "mango", "Rocket", "blend:apricot+mango"],
  ["Rocket", "apricot", "Rocket", "blend:apricot+mango"],
  ["Red Bull", "pineapple", "Red Bull", "blend:lemon+pineapple:sugarfree"],
  ["Red Bull", "berry", "Red Bull", "redbull_sods_summer_berry:sugarfree"],
  ["Red Bull", "orange", "Red Bull", "blend:orange+passion_fruit"],
  ["Red Bull", "blackcurrant", "Red Bull", "blend:blackcurrant+raspberry"],
  ["Monster", "apple", "Monster", "blend:apple+kiwi"],
  ["Monster", "peach", "Monster", "monster_rehab_peach_tea"],
  ["Monster", "pineapple", "Monster", "monster_ultra_golden_pineapple"],
  ["Monster", "grapefruit", "Monster", "monster_ultra_rosa"],
  ["Восторг", "strawberry", "Восторг", "strawberry:sugarfree"],
  ["Toxic Waste", "original", "Toxic Waste", "blend:blueberry+raspberry"],
  ["Toxic Waste", "blueberry", "Toxic Waste", "blend:blueberry+raspberry"],
  ["Lit Energy", "barberry", "Lit Energy", "blend:barberry+cranberry"],
  ["Lit Energy", "lime", "Lit Energy", "blend:lime+yuzu"],
  ["Mix", "grapefruit", "By Баста", "blend:grapefruit+lemon+orange"],
  ["My", "original", "My Element", "original"],
  ["My", "bubblegum", "My Element", "bubblegum"],
  ["Adrenaline", "pineapple", "Adrenaline Rush", "blend:pineapple+pomelo"],
  ["Adrenaline", "lime", "Adrenaline Rush", "lime"],
  ["Adrenaline Game Fuel", "original", "Adrenaline Rush", "game_fuel"],
  ["Green", "original", "Red Bull", "dragonfruit"],
  ["BY", "tropical", "Doma By Guf", "tropical"],
  ["BY", "peach", "Doma By Guf", "peach"],
  ["BY", "original", "Doma By Guf", "original"],
  ["White", "original", "White Shark", "original"],
  ["Energy", "cherry", "Ashkudi", "cherry"],
  ["Energy", "grape", "Ashkudi", "grape"],
  ["Max", "original", "Tornado", "tornado_berrycream"],
  ["Go Champ", "grapefruit", "Go Champ", "blend:grapefruit+watermelon"],
  ["Tassay", "unresolved:c5563315b9f9cea139f1f86d", "Tassay", "original"],
  ["Drive Me", "unresolved:694eb7e1e8c49093e30aa420", "Drive Me", "original"], // flyer "ДРАЙВ МИ оридж"
  ["Drive Me", "sugarfree", "Drive Me", "blend:guava+mango:sugarfree"], // Lavka "Drive Me манго без сахара" (guava + mango zero can)
  ["Volt Energy", "mango", "Volt Energy", "blend:coconut+mango"], // archived card with the coconut + mango cover
  ["Adrenaline Rush", "blend:lime+melon+mint:sugarfree", "Adrenaline Rush", "blend:lime+melon+mint"], // one flyer for Juiced melon-lime-mint and Silver zero
  ["Red Bull", "citrus", "Red Bull", "lime"], // Summer Edition "Citrus Zest" is the sudachi lime can
  ["Burn", "unresolved:8c920057d6960a32c56e29af", "Burn", "mango"], // Metro flyer "BURN арт. 241868" shows the mango can
  ["Rocket", "unresolved:e5fcf35a0a30ae2756bac51d", "Rocket", "original"], // Rocket Ride Vitamins, the same can as the original card
  ["Tornado", "unresolved:a8dfc8f215a4a82ed09c9312", "Tornado", "tornado_lemoncake"], // Magnit offer of Tornado Max Energy Lemoncake
  ["Monster", "monster_vr46", "Monster", "monster_vr46:sugarfree"], // the only non-Doctor VR46 can is the blue Zero Sugar one
  ["Mix", "orange", "Burn", "orange"], // "Mix" is Edadeal's brand for Burn "Апельсиновый микс"
  // Verified by retailer title and photo (October 2026).
  ["Adrenaline Rush", "unresolved:788ec3c0fa3f02185b46d9d2", "Adrenaline Rush", "mystery"], // "Mystic Energy", the purple limited can
  ["Adrenaline Rush", "unresolved:51389a77e8bb7f6f1fd3e3d7", "Adrenaline Rush", "mystery"], // "Mистическая Энергия" with a Latin M
  ["BOMBBAR", "unresolved:cfa54864d41bcfc651f9417b", "BOMBBAR", "gin_tonic:sugarfree"], // "со вкусом джин-тоник без сахара"
  ["Tornado", "unresolved:4d34814885aeed76ebbe4c33", "Tornado", "tornado_boost"], // "Tornado Max Energy 450мл", the photo is the Boost can
  ["X-Turbo", "unresolved:210223d3b2fa9c0cc7b69564", "X-Turbo", "blend:berry+raspberry"], // "X-Turbo Active", the photo is the red Berry Boost can
  ["Красная птица АШАН", "unresolved:9a6ed4c919a0e7a38a8b714d", "Красная птица АШАН", "original"], // the store brand's only drink
  ["Red Bull", "unresolved:8688970ebadb429a9212a309", "Red Bull", "original"], // Metro "RED BULL арт. 355879 0,473 л", the classic can
  ["My Element", "unresolved:e45481e1e9fd04a090e3575a", "My Element", "cotton_candy"], // "Cахарная вата" with a Latin C
  ["Mix", "blend:citrus+grapefruit+lemon+orange", "By Баста", "blend:grapefruit+lemon+orange"], // "BYБАСТА Цитрус микс", the same can
  // Duplicates reported by members, checked against the cover (October 2026).
  ["Lit Energy", "berry", "Lit Energy", "original"], // archived "Ягодный": its cover is the Lit Energy Classic can
  ["Flash Up", "barberry", "Flash Up", "ultra"], // archived "Барбарис": its cover is the Flash Up Ultra Energy can
  ["Pulseup", "unresolved:9427ce79d3fe662f3f4cd6a6", "Pulseup", "pulse_your"], // Ароматный мир "Энергитический напиток Pulse Up Energy 0.45л.", the Your Energy can
  ["Pulse Up", "berry", "Pulseup", "berry"], // Edadeal spells the brand "Pulse Up" for Berry Energy only
  ["Flash Up", "mango", "Flash Up", "blend:mango+pineapple"], // Близнецы "Флэш Энергия манго", the old design of the mango + pineapple can
  ["Adrenaline Game Fuel", "mango", "Adrenaline Rush", "mango"], // the mango can moved from Game Fuel to Vitamin Power; retailers sell it as both
  ["Ninja", "peach", "Ninja Star", "peach"], // Пятёрочка "Ninja Star Energy Персик-Личи" under Edadeal's brand "Ninja"
  ["Ninja", "cherry", "Ninja Star", "cherry"], // Пятёрочка "Нинджа Стар Энерджи (Ninja Star Energy) Вишня" under Edadeal's brand "Ninja"
  ["Piranha's", "berry", "Piranha's", "original"], // member drink «slam classic energy»: the photo is the Slam Classic Energy can (0101)
  ["100 Kwt", "citrus", "100 Kwt", "blend:grapefruit+orange"], // member drink «100 Kwt atomic citrus» (Atomic Heart grapefruit can), merged on the owner's request (0102)
  ["X-Turbo", "blend:peach+Сакура", "X-Turbo", "peach"], // member drink «X-Turbo персик сакура»: the old design of the Персик-Сакура can (0102)
  // The puer can says «by БАСТА ГУФ»: it is By Баста's, the «Гуф» in titles had filed it under Doma By Guf (October 2026).
  ["Doma By Guf", "doma_tangerine_puer", "By Баста", "basta_tangerine_puer"],
  ["By Баста", "unknown", "By Баста", "basta_tangerine_puer"], // archived card with the puer can on the cover
  ["Doma By Guf", "unknown", "Doma By Guf", "original"], // archived card with the Doma original can on the cover
  ["By Баста", "unresolved:bc2be25b394e530618946df8", "By Баста", "sugarfree"], // Ароматный мир "Бай Баста зеро Вакуленко В. М."
  ...['f7bd5f2b797a66d9e250bbb4', '6a0fe75d299110a452c24040', '2217aad3f2b82eb77e4f2007'].map(id => ['By Баста', `unresolved:${id}`, 'By Баста', 'original'] as const), // "Ориджинал"/"классический", the orange classic can
  // HQD Energy was renamed Ashkudi in 2025 (Роспотребнадзор banned energy drinks under the vape brand): the same cans and covers.
  ...['original', 'blackcurrant', 'blend:lemon+raspberry', 'blend:pineapple+pomelo', 'cherry', 'grape', 'orange', 'pomegranate', 'raspberry'].map(flavor => ['HQD Energy', flavor, 'Ashkudi', flavor] as const),
  ...['450e4fd85501e99911bd3df0', '26bcf023d50941e56668cc7e'].map(id => ['HQD Energy', `unresolved:${id}`, 'Ashkudi', 'ashkudi_golden_bears'] as const), // "Мармеладные мишки"
  ...['9d9d0b3f7a4bc6b815a9cf2f', 'a1c327dbc47ee82b75900565'].map(id => ['HQD Energy', `unresolved:${id}`, 'Ashkudi', 'ashkudi_sour'] as const), // "Кислое драже"
  ["HQD Energy", "unresolved:5269426748e5bbfd9aa04f6e", "Ashkudi", "ashkudi_pink_lemonade"], // "розовый лимонад"
  ["HQD Energy", "unresolved:e88e51ba96f265eaaac3e1c9", "Ashkudi", "ashkudi_belarus_apples"], // "Белорусские яблочки"
  ["HQD Energy", "unknown", "Ashkudi", "ashkudi_voltage"], // archived card with the blue Voltage can on the cover
  ["Ashkudi", "unresolved:8ee5cd706b59f0c6ac18da05", "Ashkudi", "ashkudi_sour"], // "АШКУДИ Кислое Драже"
  ...['7652380e773a72f6d8361b9d', '7dee97fa9bcdf10c765323aa'].map(id => ['Ashkudi', `unresolved:${id}`, 'Ashkudi', 'ashkudi_dynamo:sugarfree'] as const), // "Сила Динамо без сахара (Dynamo Power)"
  ["Ashkudi", "unresolved:1fc1008675af7843b3fc0fd0", "Ashkudi", "blackcurrant"], // the Surgut Currant can on the cover
];
export function reviewedProductIdentity(brand: string, flavor: string): { brand: string; flavor: string } {
  const alias = REVIEWED_PRODUCT_ALIASES.find(entry => entry[0] === brand && entry[1] === flavor);
  return alias ? { brand: alias[2], flavor: alias[3] } : { brand, flavor };
}

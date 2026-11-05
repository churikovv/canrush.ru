# CanRush Design System

## Source

Figma file `Canrush | 2026`, catalog node `454:2493` and profile node `465:2035`. Figma tokens and exported brand assets are authoritative. Generated Tailwind reference code is not copied.

## Direction

Mobile-first product interface with a bold blue shell, white content surfaces and black primary actions. The visual character is playful but controlled. No neon glow, glassmorphism, ornamental gradients or casino styling.

## Color Tokens

- `--color-brand`: `#006EFF`
- `--color-brand-deep`: `#0058CC`
- `--color-ink`: `#000000`
- `--color-text`: `#3E3E3F`
- `--color-muted`: `#989898`
- `--color-surface`: `#FFFFFF`
- `--color-subtle`: `#F3F4F6`
- `--color-control`: `#E8E8E8`
- `--color-danger`: semantic accessible red chosen against white
- `--color-focus`: high-contrast focus color distinct from the active surface

Text and interactive-state pairs must meet WCAG 2.2 AA. Color never carries status alone.

### Token layers

Colours come in layers; a rule takes the most specific layer that fits and never a raw hex the layer already names.

- `--color-*` (`:root` in `globals.css`, dark values in `site-theme.css` under `data-site-theme`): the site theme. Also
  `--color-muted-strong`, `--color-danger-soft`, `--color-success(-soft)`, `--color-action` / `--color-on-action`
  (the black primary action) and `--color-header`.
- `--brand-blue` / `--brand-blue-deep`: the CanRush blue that no theme repaints. `--color-brand` is the theme's accent
  and turns near-white in some profile themes, so fixed brand surfaces (shop, trades, game screens) use `--brand-blue`.
  `#006EFF` on white is 4.49:1, a hair under AA: small blue text uses the deep variant.
- `--theme-*` (`panel`, `subtle`, `line`, `text`, `muted`, `link`, `danger`, `success`, `tint`, `tint-strong`):
  surfaces that follow both the site theme and a profile theme. The light values are in `:root` (panel `#fff`, subtle
  `#f3f4f6`, line `#dfe3e8`, text `#111`, muted `#59616b`, link `#0058cc`, tint `#edf4ff`); the dark site theme and
  `[data-profile-theme]` set their own. Use them without a fallback — `test/design-tokens.test.ts` refuses one, and the
  same for `--color-*` tokens defined in `:root`. `--theme-tint` is the brand-tinted surface of a chosen or pressed item;
  status backgrounds take `--color-success-soft` / `--color-danger-soft`.
- `--profile-*` (`bg`, `panel`, `soft`, `ink`, `muted`, `line`, `accent`, `banner`, and `--profile-page`): one palette per
  profile theme, `PROFILE_THEMES` in `profile-appearance.ts`; contrast tweaks go through `[data-profile-tone]`.
- Section palettes: `--bc-*` for the business cabinet and admin dashboards, `--rarity-*` for Bankomat cards,
  `--foil` / `--gold` for the can-shaped game buttons. They stay inside their section.

The red `#E5484D` (likes, game health, destructive accents) is 3.9:1 on white: use it for fills, icons and large text
only; error and destructive text uses `--theme-danger`, white text on red sits on `#D1343A`.

### Scales

- Radius: `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-xl` 20, `--radius-2xl` 24, `--radius-pill` 999.
  Other radii in the CSS are older; new rules take a token.
- Layers: `--layer-raised` 20 (sticky bars, dropdowns), `--layer-bar` 30 (tab bar, floating buttons), `--layer-overlay` 40
  (game screens, «⋯» menus, cookie notice), `--layer-loading` 50, `--layer-menu` 60 (header menus), `--layer-portal` 1000,
  `--layer-toast` 1100. Small numbers inside a component stay local.
- Elevation: `--shadow-popover` for every menu, popover and dropdown. Cards stay flat.
- Motion: `--motion-fast` 150 ms for state feedback.
- Text: sizes in `rem`. Only SVG `text` keeps `px` — inside a `viewBox` it is a drawing unit.

## Typography

PP Object Sans Regular, Heavy and their slanted variants are loaded from licensed local `.woff2` files through `next/font/local`; only used styles are requested by the browser. UI labels and input text use at least 16 px where mobile browser zoom is relevant. Supporting text may use 12 to 14 px only when contrast and readability remain sufficient.

## Spacing and Shape

Use a 4/8 px rhythm. The phone gutter is one for the whole site, 16 px (below 640 px); wider from 640 px. Controls take
at least 44 px hit areas. Radii in use: 999 px for pills and round buttons, 16 px for fields and cards, 12 px for
smaller controls and tiles, 8 px for compact chips; prefer these over new values. Primary content surfaces use 32 px
top corners where they overlap the shell. Avoid nested cards and decorative shadows.

Breakpoints: phones are `max-width: 639px`, tablets and up `min-width: 640px`, desktop navigation `min-width: 960px`
(`max-width: 959px` below it). Never write `max-width: 640px`: at exactly 640 px it overlaps the `min-width: 640px` rules.

## Components

- Header: on the theme's neutral substrate (`--color-subtle`), the page surface rounded over it; the mark is masked with `--color-brand`, the wordmark with `--color-ink`. Menus «Сообщество» and «Магазины» and «Для бизнеса» appear from 960 px; the profile avatar (or «Войти») sits at the right on every width.
- Tab bar: below 960 px, a classic iOS bar fixed to the bottom: white surface, 0.5 px top hairline, 50 px items plus the bottom safe area (44 px in short landscape viewports). Tabs, in order: Главная, Трекер, Поиск (a round button in the middle), Сообщество, Новости. The profile lives in the header, not the tab bar. Phones stack 24 px filled icons over 12 px labels (11 px below 360 px so every label fits at 320 px); from 640 px and in landscape the icon sits beside a 14 px label and items center at up to 144 px each. Unselected tabs use `--color-muted-strong`; the current tab uses a `--color-brand` icon and a Heavy `--color-brand-deep` label, so color is not the only cue. A tapped tab takes the selected style while navigation is pending. Fixed bottom UI stacks above it through `--site-tab-bar-offset`.
- Auth panel: one visible email label, helper text, 48 to 56 px input and button, inline validation and one primary action.
- Primary button: black surface, white text, 16 px radius, clear hover, focus, active, loading and disabled states.
- Profile banner: blue 342 by 120 proportion on mobile with the exact Figma profile illustration aligned left.
- Information surface: white section with concise rows and no fabricated metrics.
- Footer: `--color-action` surface (black; near-black in the dark theme), exact white mark and wordmark, the partner plate, restrained legal text. Hidden in the apps.

### Shared components

Reach for these before writing a new one (details in `AGENTS.md`):

- Bottom sheet `BottomSheet` + `BottomSheetHead` for any window over the page; full-screen viewers (`PhotoViewer`, `CardInspector`) are the exception.
- `FormAlert` for a form's result above its buttons, `.field-error` for one field; `ActionToast` for a quick success or error of a community action.
- `MoreActions` («⋯») for item actions; `.more-actions-item` buttons or links inside.
- `.settings-switch` for on/off (a checkbox with `role="switch"`), `.settings-list` / `.settings-row` for setting rows.
- `SignInPrompt` wherever a guest would see a form.
- Fields look like `.catalog-search-field`: `--color-subtle` fill, transparent border, 16 px radius, 48 px tall, 3 px focus outline.
- Secondary actions inside cards are pills with an icon (`.swipe-more`: «О напитке», «Профиль»; `.app-offer-apk`), never underlined text links.
- Game screens (pass, engine, Bankomat, collection, trades, battle, achievements) are dark in every site theme and use `.can-btn` / `.can-plate`, the ATM key `.atm-key` for anything that leads to a pull, `.game-btn` in battle.

- Buttons: `.community-button` is the primary button (action colours, `--radius-md`), `.community-button-secondary` and `-text` its variants, `.primary-button` its large full-width variant (sign-in, `--radius-lg`). The business landing (`.biz-*`), the dashboards (`.bc-*`) and game screens keep their own buttons.
- One switch (`.settings-switch`; the presence toggle is a button styled the same) and one toast (`ActionToast`).

### Class names

A section's classes share its prefix. Short prefixes in use: `bc-` business cabinet and admin dashboards, `biz-` business
landing, `bt-` battle, `ae-` article editor, `trd-` card trades, `inv-` card collection, `lb-` leaderboard, `tg-`
Telegram, `ach-` achievement emblem, `can-` can-shaped game controls, `go-` home services. New sections take a full word
(`catalog-`, `store-`, `market-`). Buttons end in `-button` (the older `-btn` stay until their section is reworked);
states are `is-*` classes or `data-*` / ARIA attributes, never a new class name per state.

## Auth States

- Idle: email field and primary send action.
- Loading: disabled field/action with textual progress.
- Sent: neutral confirmation that does not expose account existence.
- Error: inline cause and recovery action.
- Confirm: explicit POST action before token redemption.
- Invalid link: expired, used and malformed links share safe recovery copy.
- Authenticated: protected profile and current-session logout.

## Responsive and Motion

Start at 375 to 390 px and support 320 px without horizontal scrolling. At desktop widths, retain a focused reading column rather than stretching the mobile composition. Verify landscape and large text. Motion is limited to 150 to 250 ms state feedback using opacity or transform, never required for comprehension, and disabled or reduced through `prefers-reduced-motion`.

## Assets

Use local files under `apps/site/public/brand`. Preserve SVG view boxes and explicit rendered dimensions. Do not redraw, recolor or stretch the logo and profile illustration.


## Profile customization

- The public profile and edit screen share `ProfileHeader`; Save occupies the header action position used by Edit.
- Desktop edit fields use the available page width; phones stack fields and image controls.
- Avatar and banner uploads preview in the header before saving. Custom images use centered cover cropping; the built-in brand artwork remains the default.
- One earned tag can be active, or none. The selected tag is visible near the username in existing and new reviews. The Admin tag requires current admin rights.

Профиль: компактный синий бейдж уровня рядом с тегом, отдельная карточка XP с прогрессом и ссылкой на рейтинг. Стена использует аватар, ник, тег и уровень автора. Редактирование изображений — нативный modal dialog с квадратной областью аватара и баннером 4:1, ползунками масштаба и положения; перетаскивание файлов доступно непосредственно на изображениях. Вкладка профиля активна и на страницах входа, подтверждения и всех разделах `/profile`.

Город располагается рядом с логотипом в синем хедере, на мобильном справа. Выбор в нативном диалоге: поиск, список городов, текущий выбор, определение по геолокации с явным подтверждением найденного города; отказ и отсутствие покрытия не блокируют ручной выбор. Каталог и цены коротко подписаны выбранным городом; регион без данных имеет честное пустое состояние.

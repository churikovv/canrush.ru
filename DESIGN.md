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

## Typography

PP Object Sans Regular, Heavy and their slanted variants are loaded from licensed local `.woff2` files through `next/font/local`; only used styles are requested by the browser. UI labels and input text use at least 16 px where mobile browser zoom is relevant. Supporting text may use 12 to 14 px only when contrast and readability remain sufficient.

## Spacing and Shape

Use a 4/8 px rhythm. Mobile gutters are 12 or 24 px, matching Figma. Controls use 16 px radii and at least 44 px hit areas. Primary content surfaces use up to 32 px top corners where they overlap the blue shell. Avoid nested cards and decorative shadows.

## Components

- Header: blue surface, 36 by 30 px Figma logo mark, simple text actions with accessible labels.
- Auth panel: one visible email label, helper text, 48 to 56 px input and button, inline validation and one primary action.
- Primary button: black surface, white text, 16 px radius, clear hover, focus, active, loading and disabled states.
- Profile banner: blue 342 by 120 proportion on mobile with the exact Figma profile illustration aligned left.
- Information surface: white section with concise rows and no fabricated metrics.
- Footer: black surface, exact white mark and wordmark, restrained legal text.

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

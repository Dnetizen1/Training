---
name: apple-design
description: "Apple design language for UI work: restrained palette (#1D1D1F / #F5F5F7 / #FFFFFF, one accent), SF Pro type with tight display tracking, generous whitespace, 12–20px radii, pill buttons, layered soft shadows, crisp copy. Invoke when the user asks for an Apple / iOS / apple.com look, then read the reference files below for exact tokens."
---

# Apple Design

Vendored from [chaos-xxl/apple-design-skill](https://github.com/chaos-xxl/apple-design-skill) (MIT, see `LICENSE`).
The original targets apple.com marketing pages; the rules below keep its tokens and principles and add how to apply them to
this repo's app — a phone workout tracker in Russian (`src/ios.css`, screens in `src/*.js`). Load `design-system` first
for general craft rules; this skill only sets the visual language.

## Principles

1. **Simplicity over decoration.** Remove every element that does not serve a clear purpose. If in doubt, leave it out.
2. **Whitespace is a feature.** Room around content creates hierarchy; never fill space because it is there.
3. **Typography-first hierarchy.** One large, bold figure or title anchors each screen; everything else steps down in size and weight.
4. **Restrained color.** Backgrounds alternate between white, `#F5F5F7` and `#1D1D1F`/black. Content, not color, does the talking. One accent for interactive elements, used sparingly.
5. **Precision in detail.** 12–20px corners, multi-layer soft shadows, smooth transitions, aligned baselines.
6. **Content-centered.** Text stays within a measured column; only imagery or charts go full-bleed.

## Reference files (read for exact values)

| Need | File |
|---|---|
| Colors, spacing, weights, radii, shadows, gradients, breakpoints | `reference/design-tokens.md` |
| Font stacks, type scale, tracking, line-height | `reference/typography.md` |
| Headline and body copy patterns | `reference/copywriting.md` |
| Imagery and CSS fallbacks | `reference/image-curation.md` |
| Page sections: hero, grid, cards, scroll | `reference/layout-patterns.md` |

Load order for a full screen: tokens → typography → copywriting → layout.

## Applying it to this app

The reference files are written for desktop marketing pages. On a 390px phone screen:

- **Scale down the type ramp, keep the contrast.** Display numbers 34–56px, weight 600–700, letter-spacing −0.02 to −0.03em;
  titles 20–28px/600; body 15–17px/400; captions 12–13px in `#6E6E73` (light) or `#86868B` (dark). Use tabular figures for all numbers.
- **Fonts.** `-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif` — SF covers Cyrillic. Do not fall back to Inter
  (the `design-system` skill bans it); system-ui is the fallback.
- **Spacing.** Section gaps 32–48px instead of 80–120px; card padding 16–24px; screen gutter 16–20px.
- **Surfaces.** Light: `#F5F5F7` ground with white cards, or white ground with `#F5F5F7` cards. Dark: black ground with `#1C1C1E` /
  `#2C2C2E` cards. Cards carry `--apple-shadow-sm` in light mode and no shadow in dark mode.
- **Accent.** One interactive accent (`#0066CC` light, `#2997FF` dark) for links, primary buttons and the current tab. Data colors
  (muscle load, day colors) are a separate, quiet scale and never compete with the accent.
- **Controls.** Pill buttons (`--apple-radius-button`), 44px minimum targets, segmented controls with a raised white thumb,
  translucent blurred bars (`backdrop-filter: saturate(180%) blur(20px)`) for the tab bar and sticky headers.
- **Copy.** Short, declarative, confident (see `reference/copywriting.md`): «Готово.» not «Тренировка успешно завершена!».
  Russian copy keeps «ёлочки» and sentence case.
- **Gradients.** Text gradients only on a single hero figure per screen, if at all. Never on buttons or backgrounds of cards.

## Output rules

- Tokens as CSS custom properties; never hard-code a value the tokens define.
- Semantic markup, real `<button>` / `<input>` / `<label>`, `aria-label` on icon-only buttons.
- Contrast 4.5:1 for text (3:1 at 24px+); check the grey captions on `#F5F5F7` and on dark cards.

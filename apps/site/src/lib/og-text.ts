/**
 * Every character PP Object Sans has. next/og fetches a missing glyph from Google Fonts and emoji from a CDN at render
 * time, so anything else is dropped from the text before it reaches the picture.
 */
const NOT_IN_FONT = /[^ -~¡-©«¬®-±´-¸»¿-ÏÑ-Ýß-ïñ-ýÿ-ģĨ-īĮ-ĳĶķĹ-ľŁ-ňŌ-ťŨ-žЁ-ЊЌЎ-яё-ќўџҐґ–—‘-‚“-„†-•…‰‹›€₽№™]/gu;

export function ogText(text: string): string {
  return text.replace(/\s+/gu, ' ').replace(NOT_IN_FONT, '').replace(/ {2,}/gu, ' ').trim();
}

/** The headline shrinks with its length, so a long name still fits three lines beside the picture. */
export function ogTitleSize(text: string): number {
  return text.length <= 22 ? 76 : text.length <= 44 ? 60 : 48;
}

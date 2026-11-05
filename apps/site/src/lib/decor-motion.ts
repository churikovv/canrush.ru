/**
 * Animation of profile tags, avatar frames and the sheen of level chips: off unless the member turns it on in the settings («Анимация тегов и
 * рамок»). Dozens of glowing tags and moving frames in a list slowed weak phones down, so the site starts calm. The
 * choice is this browser's (a cookie, like the theme): the root layout puts `data-decor-motion` on `<html>` from it,
 * and globals.css pauses the animations without it.
 */
export const DECOR_MOTION_COOKIE = 'canrush-decor-motion';

/** Only an explicit «on» animates; no cookie, an old value or anything else stays still. */
export function decorMotionOn(value: unknown): boolean {
  return value === 'on';
}

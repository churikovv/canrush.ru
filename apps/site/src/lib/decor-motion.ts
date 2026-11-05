/**
 * Animation of profile tags, avatar frames and the sheen of level chips. By default it follows the device: on a
 * computer it moves, on a touch screen (phones, tablets, the apps) it stands still — dozens of glowing tags and moving
 * frames in a list slowed weak phones down. The member can fix it either way in the settings («Анимация тегов и
 * рамок»). The choice is this browser's (a cookie, like the theme); the root layout puts it on `<html>` as
 * `data-decor-motion` (no attribute — automatic), and globals.css pauses the animations accordingly.
 */
export const DECOR_MOTION_COOKIE = 'canrush-decor-motion';

/** The member's own choice, or null — follow the device. */
export type DecorMotionChoice = 'on' | 'off' | null;

export function decorMotionChoice(value: unknown): DecorMotionChoice {
  return value === 'on' || value === 'off' ? value : null;
}

/**
 * The devices where the automatic setting stands still: a touch screen or no hover. globals.css pauses by the same
 * media query, so the switch shows what the page does.
 */
export const STILL_DEVICE_QUERY = '(hover: none), (pointer: coarse)';

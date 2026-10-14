// apps/studio/src/tools/dither-tool.ts
// Thuat toan tao hoa tiet xen ke caro Checker Dither

import { PixelColor } from '@pixel-draw/shared-types';

export function applyDitherPattern(
  x: number,
  y: number,
  colorA: PixelColor,
  colorB: PixelColor
): PixelColor {
  const isAlt = (Math.abs(Math.floor(x)) + Math.abs(Math.floor(y))) % 2 === 1;
  return isAlt ? colorB : colorA;
}

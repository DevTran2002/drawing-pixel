// apps/studio/src/tools/shade-tool.ts
// Thuat toan tang giam do sang cho cong cu Lighten va Darken

import { PixelColor } from '@pixel-draw/shared-types';

export function adjustBrightness(hexColor: PixelColor, percent: number): PixelColor {
  if (!hexColor) return null;

  // Chuan hoa ma hex 3 ky tu (#abc) sang 6 ky tu (#aabbcc)
  let cleanHex = hexColor.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map(c => c + c)
      .join('');
  }

  if (cleanHex.length < 6) return hexColor;

  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  const delta = Math.floor((percent / 100) * 255);

  r = Math.min(255, Math.max(0, r + delta));
  g = Math.min(255, Math.max(0, g + delta));
  b = Math.min(255, Math.max(0, b + delta));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

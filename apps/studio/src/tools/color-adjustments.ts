// apps/studio/src/tools/color-adjustments.ts
// Module bien doi va can chinh mau sac diem anh phong cach Photoshop cho Pixel Art Studio

export interface HslAdjustmentOptions {
  type: 'hsl';
  hue: number;        // -180 den +180
  saturation: number; // -100 den +100
  lightness: number;  // -100 den +100
}

export interface BrightnessContrastOptions {
  type: 'brightness-contrast';
  brightness: number; // -100 den +100
  contrast: number;   // -100 den +100
}

export interface InvertColorOptions {
  type: 'invert';
}

export interface ReplaceColorOptions {
  type: 'replace';
  fromColor: string;
  toColor: string;
  tolerance: number;  // 0 den 100
}

export type ColorAdjustmentOptions =
  | HslAdjustmentOptions
  | BrightnessContrastOptions
  | InvertColorOptions
  | ReplaceColorOptions;

// Chuyen doi ma mau Hex sang bo ba [r, g, b]
export function hexToRgb(hex: string | null): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }
  return null;
}

// Chuyen bo ba [r, g, b] thanh ma mau Hex
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Chuyen RGB sang HSL [H (0-360), S (0-100), L (0-100)]
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      case bn:
        h = (rn - gn) / delta + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Chuyen HSL [H (0-360), S (0-100), L (0-100)] sang RGB
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const val = Math.round(ln * 255);
    return [val, val, val];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let normalizedT = t;
    if (normalizedT < 0) normalizedT += 1;
    if (normalizedT > 1) normalizedT -= 1;
    if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT;
    if (normalizedT < 1 / 2) return q;
    if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  const r = Math.round(hue2rgb(p, q, hn + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hn) * 255);
  const b = Math.round(hue2rgb(p, q, hn - 1 / 3) * 255);

  return [r, g, b];
}

// Tinh sai biet khoang cach mau theo dung sai Euclidean trong khong gian RGB
export function isColorMatch(hexA: string | null, hexB: string | null, tolerance: number): boolean {
  if (hexA === hexB) return true;
  if (!hexA || !hexB) return false;
  if (tolerance <= 0) return hexA.toLowerCase() === hexB.toLowerCase();

  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return false;

  const dr = rgbA[0] - rgbB[0];
  const dg = rgbA[1] - rgbB[1];
  const db = rgbA[2] - rgbB[2];
  const dist = (Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(255 * 255 * 3)) * 100;
  return dist <= tolerance;
}

// Dieu chinh Hue, Saturation va Lightness cua mot ma mau Hex
export function adjustHsl(hex: string, deltaH: number, deltaS: number, deltaL: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const newH = ((h + deltaH) % 360 + 360) % 360;
  const newS = Math.max(0, Math.min(100, s + deltaS));
  const newL = Math.max(0, Math.min(100, l + deltaL));

  const [r, g, b] = hslToRgb(newH, newS, newL);
  return rgbToHex(r, g, b);
}

// Dieu chinh Do sang va Do tuong phan
export function adjustBrightnessContrast(hex: string, brightness: number, contrast: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  // Tinh he so tuong phan
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const r = factor * (rgb[0] - 128) + 128 + brightness;
  const g = factor * (rgb[1] - 128) + 128 + brightness;
  const b = factor * (rgb[2] - 128) + 128 + brightness;

  return rgbToHex(r, g, b);
}

// Dao nguoc mau sac (Invert Colors)
export function invertHexColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(255 - rgb[0], 255 - rgb[1], 255 - rgb[2]);
}

// Thay the mau (Color Replace / Palette Swap)
export function replaceHexColor(
  hex: string,
  targetHex: string,
  replacementHex: string,
  tolerance = 0
): string {
  if (isColorMatch(hex, targetHex, tolerance)) {
    return replacementHex;
  }
  return hex;
}

// Ap dung dieu chinh mau sac len mot tap hop Pixel (co ho tro Selection Mask)
export function applyColorAdjustment(
  pixels: Record<string, string>,
  options: ColorAdjustmentOptions,
  selectionMask?: Set<string>
): Record<string, string> {
  const result: Record<string, string> = { ...pixels };

  for (const [key, color] of Object.entries(pixels)) {
    if (!color) continue;
    // Neu co Selection Mask thi chi sua nhung pixel nam trong mask
    if (selectionMask && !selectionMask.has(key)) {
      continue;
    }

    let modified = color;
    switch (options.type) {
      case 'hsl':
        modified = adjustHsl(color, options.hue, options.saturation, options.lightness);
        break;
      case 'brightness-contrast':
        modified = adjustBrightnessContrast(color, options.brightness, options.contrast);
        break;
      case 'invert':
        modified = invertHexColor(color);
        break;
      case 'replace':
        modified = replaceHexColor(color, options.fromColor, options.toColor, options.tolerance);
        break;
    }

    result[key] = modified;
  }

  return result;
}

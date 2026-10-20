import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  adjustHsl,
  adjustBrightnessContrast,
  invertHexColor,
  replaceHexColor,
  applyColorAdjustment
} from '../src/tools/color-adjustments';

describe('Color Adjustments Engine', () => {
  it('chuyen doi qua lai chinh xac giua RGB va HSL', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0); // Do thuan
    expect(h).toBe(0);
    expect(s).toBe(100);
    expect(l).toBe(50);
    const [r, g, b] = hslToRgb(h, s, l);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('dao nguoc mau sac chinh xac', () => {
    expect(invertHexColor('#000000')).toBe('#ffffff');
    expect(invertHexColor('#ffffff')).toBe('#000000');
    expect(invertHexColor('#ff0000')).toBe('#00ffff');
  });

  it('thay the dung mau theo chi dinh', () => {
    expect(replaceHexColor('#ff0000', '#ff0000', '#0000ff', 0)).toBe('#0000ff');
    expect(replaceHexColor('#00ff00', '#ff0000', '#0000ff', 0)).toBe('#00ff00');
  });

  it('dieu chinh do sang va tuong phan', () => {
    // Tang sang mau xam
    const brighter = adjustBrightnessContrast('#808080', 50, 0);
    expect(brighter).not.toBe('#808080');
  });

  it('chi ap dung doi mau cho pixel nam trong selection mask', () => {
    const original = {
      '0,0': '#ff0000',
      '1,1': '#ff0000'
    };
    const mask = new Set(['0,0']);
    const result = applyColorAdjustment(original, { type: 'invert' }, mask);
    expect(result['0,0']).toBe('#00ffff');
    expect(result['1,1']).toBe('#ff0000'); // Khong bi doi vi nam ngoai mask
  });

  it('ap dung toan bo layer neu khong co mask', () => {
    const original = {
      '0,0': '#ff0000',
      '1,1': '#ff0000'
    };
    const result = applyColorAdjustment(original, { type: 'invert' });
    expect(result['0,0']).toBe('#00ffff');
    expect(result['1,1']).toBe('#00ffff');
  });
});

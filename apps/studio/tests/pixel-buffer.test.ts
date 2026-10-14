import { describe, it, expect } from 'vitest';
import { PixelBuffer } from '../src/core/pixel-buffer';

describe('PixelBuffer Core', () => {
  it('khoi tao dung kich thuoc va mac dinh toan bo la trong suot', () => {
    const buffer = new PixelBuffer(8, 8);
    expect(buffer.width).toBe(8);
    expect(buffer.height).toBe(8);
    expect(buffer.getPixel(0, 0)).toBeNull();
    expect(buffer.getPixel(7, 7)).toBeNull();
  });

  it('dat va lay pixel chinh xac tai toa do', () => {
    const buffer = new PixelBuffer(16, 16);
    buffer.setPixel(5, 5, '#ff0000');
    expect(buffer.getPixel(5, 5)).toBe('#ff0000');
    expect(buffer.getPixel(5, 6)).toBeNull();
  });

  it('khong dat pixel ngoai bien canvas', () => {
    const buffer = new PixelBuffer(10, 10);
    const result = buffer.setPixel(15, 20, '#00ff00');
    expect(result).toBe(false);
  });

  it('nap ma tran ky tu voi bang mau hex chinh xac', () => {
    const buffer = new PixelBuffer(4, 4);
    const matrix = [
      '.XX.',
      'X..X',
      'X..X',
      '.XX.'
    ];
    const palette = {
      'X': '#000000',
      '.': null
    };
    buffer.fromMatrix(matrix, palette);
    expect(buffer.getPixel(0, 0)).toBeNull();
    expect(buffer.getPixel(1, 0)).toBe('#000000');
    expect(buffer.getPixel(2, 0)).toBe('#000000');
    expect(buffer.getPixel(1, 1)).toBeNull();
  });

  it('xuat ra doi tuong record pixels hop le de serialize', () => {
    const buffer = new PixelBuffer(4, 4);
    buffer.setPixel(1, 2, '#123456');
    const record = buffer.toRecord();
    expect(record['1,2']).toBe('#123456');
  });
});

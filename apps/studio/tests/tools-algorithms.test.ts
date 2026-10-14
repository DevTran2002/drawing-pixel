import { describe, it, expect } from 'vitest';
import { drawLineBresenham } from '../src/tools/line-tool';
import { drawCircleMidpoint, drawRectBorders } from '../src/tools/shape-tool';
import { floodFill } from '../src/tools/bucket-tool';
import { applyDitherPattern } from '../src/tools/dither-tool';
import { adjustBrightness } from '../src/tools/shade-tool';
import { getSymmetricPoints } from '../src/tools/symmetry-manager';
import { PixelBuffer } from '../src/core/pixel-buffer';

describe('Cac Thuat Toan Cong Cu Ve Pixel', () => {
  it('ve doan thang Bresenham noi dung cac toa do lien tiep', () => {
    const points = drawLineBresenham(0, 0, 3, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 }
    ]);
  });

  it('ve vien hinh chu nhat dung toa do 4 canh', () => {
    const points = drawRectBorders(1, 1, 3, 3);
    // Cac diem tao thanh vien hcn tu (1,1) den (3,3)
    expect(points.some(p => p.x === 1 && p.y === 1)).toBe(true);
    expect(points.some(p => p.x === 3 && p.y === 3)).toBe(true);
    expect(points.some(p => p.x === 2 && p.y === 2)).toBe(false); // Tam rỗng
  });

  it('ve duong tron Midpoint can doi', () => {
    const points = drawCircleMidpoint(5, 5, 2);
    expect(points.length).toBeGreaterThan(0);
    // Phai chua cac diem dinh cuc tren/duoi/trai/phai
    expect(points.some(p => p.x === 5 && p.y === 3)).toBe(true);
    expect(points.some(p => p.x === 5 && p.y === 7)).toBe(true);
    expect(points.some(p => p.x === 3 && p.y === 5)).toBe(true);
    expect(points.some(p => p.x === 7 && p.y === 5)).toBe(true);
  });

  it('floodFill to mau dung vung va dung lai o bien chan', () => {
    const buf = new PixelBuffer(5, 5);
    // Tao hang rao ngan o cot 2
    for (let y = 0; y < 5; y++) {
      buf.setPixel(2, y, '#000000');
    }
    const changes = floodFill(buf, 0, 0, '#ffffff');
    expect(changes.length).toBe(10); // 2 cot x 5 hang = 10 pixels
    expect(buf.getPixel(0, 0)).toBe('#ffffff');
    expect(buf.getPixel(1, 4)).toBe('#ffffff');
    expect(buf.getPixel(3, 0)).toBeNull(); // Nua ben phai khong bi to
  });

  it('applyDitherPattern tao hoa tiet xen ke caro chinh xac', () => {
    const colorA = '#111111';
    const colorB = '#222222';
    expect(applyDitherPattern(0, 0, colorA, colorB)).toBe(colorA);
    expect(applyDitherPattern(1, 0, colorA, colorB)).toBe(colorB);
    expect(applyDitherPattern(0, 1, colorA, colorB)).toBe(colorB);
    expect(applyDitherPattern(1, 1, colorA, colorB)).toBe(colorA);
  });

  it('adjustBrightness lam sang va toi mau hex', () => {
    const lightened = adjustBrightness('#505050', 20); // Sang len
    expect(lightened).not.toBe('#505050');
    const darkened = adjustBrightness('#505050', -20); // Toi di
    expect(darkened).not.toBe('#505050');
  });

  it('getSymmetricPoints tinh dung toa do doi xung guong', () => {
    // Canvas 10x10, diem (2, 3), doi xung truc doc X o giua (x = 5)
    const points = getSymmetricPoints(2, 3, 10, 10, true, false);
    expect(points).toEqual([
      { x: 2, y: 3 },
      { x: 7, y: 3 }
    ]);
  });
});

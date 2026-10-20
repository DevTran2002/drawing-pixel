import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../src/tools/selection-tool';

describe('SelectionManager Magic Wand va Mask', () => {
  let manager: SelectionManager;

  beforeEach(() => {
    manager = new SelectionManager();
  });

  it('chon pixel lien ke cung mau khi contiguous = true', () => {
    const pixels: Record<string, string> = {
      '0,0': '#ff0000',
      '1,0': '#ff0000',
      '0,1': '#ff0000',
      '3,3': '#ff0000' // Pixel tach roi
    };
    const mask = manager.selectByWand(0, 0, true, 0, pixels, 4, 4);
    expect(mask.has('0,0')).toBe(true);
    expect(mask.has('1,0')).toBe(true);
    expect(mask.has('0,1')).toBe(true);
    expect(mask.has('3,3')).toBe(false); // Khong chon pixel tach roi khi contiguous = true
    expect(manager.isPixelSelected(0, 0)).toBe(true);
    expect(manager.isPixelSelected(3, 3)).toBe(false);
  });

  it('chon toan bo pixel cung mau tren canvas khi contiguous = false', () => {
    const pixels: Record<string, string> = {
      '0,0': '#ff0000',
      '1,0': '#00ff00',
      '3,3': '#ff0000'
    };
    const mask = manager.selectByWand(0, 0, false, 0, pixels, 4, 4);
    expect(mask.has('0,0')).toBe(true);
    expect(mask.has('3,3')).toBe(true);
    expect(mask.has('1,0')).toBe(false);
  });

  it('tinh dung bounding box cho mask khong dong nhat', () => {
    const pixels: Record<string, string> = {
      '2,2': '#ff0000',
      '5,6': '#ff0000'
    };
    manager.selectByWand(2, 2, false, 0, pixels, 10, 10);
    const box = manager.getMaskBoundingBox();
    expect(box).not.toBeNull();
    expect(box?.x).toBe(2);
    expect(box?.y).toBe(2);
    expect(box?.width).toBe(4); // 5 - 2 + 1
    expect(box?.height).toBe(5); // 6 - 2 + 1
  });

  it('chon mau tuong dong khi tolerance lon hon 0', () => {
    const pixels: Record<string, string> = {
      '0,0': '#ff0000',
      '1,0': '#fe0202', // Gan giong do
      '2,0': '#0000ff'  // Xanh duong khac han
    };
    const mask = manager.selectByWand(0, 0, false, 15, pixels, 4, 4);
    expect(mask.has('0,0')).toBe(true);
    expect(mask.has('1,0')).toBe(true);
    expect(mask.has('2,0')).toBe(false);
  });
});

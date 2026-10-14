import { describe, it, expect } from 'vitest';
import { exportPngBuffer, generateSpriteSheetMetadata } from '../src/exporter';
import { PNG } from 'pngjs';
import { AnimationClip, FrameData } from '@pixel-draw/shared-types';

describe('Server Exporter Module', () => {
  it('xuat PNG buffer voi scale 4x khong lam mo pixel', async () => {
    // 2x2 canvas voi pixel (0,0) la mau do #ff0000, pixel (1,1) la mau xanh #00ff00
    const pixels = {
      '0,0': '#ff0000',
      '1,1': '#00ff00'
    };
    const scale = 4;
    const pngBuffer = await exportPngBuffer(2, 2, pixels, scale);
    expect(pngBuffer).toBeInstanceOf(Buffer);

    // Doc lai PNG bang pngjs de kiem tra kich thuoc va mau sac
    const parsed = PNG.sync.read(pngBuffer);
    expect(parsed.width).toBe(8); // 2 * 4 = 8
    expect(parsed.height).toBe(8); // 2 * 4 = 8

    // Kiem tra pixel tai (0,0) den (3,3) phai la mau do RGBA (255, 0, 0, 255)
    const idx0 = (0 * parsed.width + 0) * 4;
    expect(parsed.data[idx0]).toBe(255);
    expect(parsed.data[idx0 + 1]).toBe(0);
    expect(parsed.data[idx0 + 2]).toBe(0);
    expect(parsed.data[idx0 + 3]).toBe(255);

    // Kiem tra pixel tai (4,4) phai la mau xanh RGBA (0, 255, 0, 255)
    const idx4 = (4 * parsed.width + 4) * 4;
    expect(parsed.data[idx4]).toBe(0);
    expect(parsed.data[idx4 + 1]).toBe(255);
    expect(parsed.data[idx4 + 2]).toBe(0);
    expect(parsed.data[idx4 + 3]).toBe(255);
  });

  it('tao file JSON metadata cho spritesheet chuan Game Engine', () => {
    const clips: AnimationClip[] = [
      { id: 'c1', name: 'idle', startFrame: 0, endFrame: 1, fps: 10, loop: true },
      { id: 'c2', name: 'walk', startFrame: 2, endFrame: 5, fps: 12, loop: true }
    ];
    const frames: FrameData[] = Array.from({ length: 6 }, (_, i) => ({
      id: `f_${i}`,
      durationMs: 100,
      layers: [{ id: 'l1', name: 'Layer 1', visible: true, locked: false, opacity: 1, pixels: {} }]
    }));

    const meta = generateSpriteSheetMetadata(24, 24, 1, frames, clips, 'hero_sheet.png');
    expect(meta.meta.image).toBe('hero_sheet.png');
    expect(meta.meta.size.w).toBe(24 * 6); // 144
    expect(meta.meta.size.h).toBe(24);
    expect(Object.keys(meta.frames).length).toBe(6);
    expect(meta.animations.walk).toEqual([2, 3, 4, 5]);
  });
});

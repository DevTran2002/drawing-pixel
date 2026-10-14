// apps/server/src/exporter.ts
// Module xuat anh PNG Nearest-Neighbor va SpriteSheet kem JSON metadata

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { AnimationClip, FrameData, PixelColor } from '@pixel-draw/shared-types';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Chuyen doi ma Hex sang RGBA
function hexToRgba(hex: PixelColor): RGBA {
  if (!hex) return { r: 0, g: 0, b: 0, a: 0 };

  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }

  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
      a: 255
    };
  }

  if (clean.length === 8) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
      a: parseInt(clean.substring(6, 8), 16)
    };
  }

  return { r: 0, g: 0, b: 0, a: 0 };
}

// Xuat buffer PNG tu danh sach pixel voi thuat toan phong to Nearest-Neighbor
export async function exportPngBuffer(
  width: number,
  height: number,
  pixels: Record<string, PixelColor>,
  scale = 1
): Promise<Buffer> {
  const targetWidth = width * scale;
  const targetHeight = height * scale;

  const png = new PNG({
    width: targetWidth,
    height: targetHeight,
    colorType: 6 // RGBA
  });

  // Dien mac dinh trong suot
  png.data.fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[`${x},${y}`];
      if (!color) continue;

      const rgba = hexToRgba(color);

      // Phong to pixel goc thanh khoi (scale x scale)
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const targetX = x * scale + sx;
          const targetY = y * scale + sy;
          const idx = (targetY * targetWidth + targetX) * 4;

          png.data[idx] = rgba.r;
          png.data[idx + 1] = rgba.g;
          png.data[idx + 2] = rgba.b;
          png.data[idx + 3] = rgba.a;
        }
      }
    }
  }

  return PNG.sync.write(png);
}

// Xuat toan bo frame thanh mot dải SpriteSheet ngang
export async function exportSpriteSheetBuffer(
  width: number,
  height: number,
  frames: FrameData[],
  scale = 1
): Promise<Buffer> {
  const frameCount = frames.length;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const sheetWidth = scaledWidth * frameCount;
  const sheetHeight = scaledHeight;

  const png = new PNG({
    width: sheetWidth,
    height: sheetHeight,
    colorType: 6
  });
  png.data.fill(0);

  frames.forEach((frame, frameIdx) => {
    const frameOffsetX = frameIdx * scaledWidth;

    // Gop tat ca cac layer trong frame
    for (const layer of frame.layers) {
      if (!layer.visible) continue;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = layer.pixels[`${x},${y}`];
          if (!color) continue;

          const rgba = hexToRgba(color);

          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const targetX = frameOffsetX + (x * scale + sx);
              const targetY = y * scale + sy;
              const idx = (targetY * sheetWidth + targetX) * 4;

              png.data[idx] = rgba.r;
              png.data[idx + 1] = rgba.g;
              png.data[idx + 2] = rgba.b;
              png.data[idx + 3] = rgba.a;
            }
          }
        }
      }
    }
  });

  return PNG.sync.write(png);
}

// Sinh file JSON metadata chuan cho Game Engine
export function generateSpriteSheetMetadata(
  width: number,
  height: number,
  scale: number,
  frames: FrameData[],
  clips: AnimationClip[],
  imageName: string
) {
  const scaledW = width * scale;
  const scaledH = height * scale;
  const sheetW = scaledW * frames.length;
  const sheetH = scaledH;

  const framesDict: Record<string, any> = {};
  frames.forEach((frame, idx) => {
    framesDict[`frame_${idx}`] = {
      frame: { x: idx * scaledW, y: 0, w: scaledW, h: scaledH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: scaledW, h: scaledH },
      sourceSize: { w: scaledW, h: scaledH },
      duration: frame.durationMs
    };
  });

  const animations: Record<string, number[]> = {};
  for (const clip of clips) {
    const indices: number[] = [];
    for (let f = clip.startFrame; f <= clip.endFrame; f++) {
      indices.push(f);
    }
    animations[clip.name] = indices;
  }

  return {
    frames: framesDict,
    animations,
    meta: {
      app: 'Pixel Studio Engine',
      version: '1.0',
      image: imageName,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: `${scale}`
    }
  };
}

// Luu buffer ra dia cung
export async function saveToFile(filePath: string, content: Buffer | string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.writeFile(resolvedPath, content);
  return resolvedPath;
}

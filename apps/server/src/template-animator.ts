// apps/server/src/template-animator.ts
// Bo tao hoat anh bang khung xuong va phep bien doi diem anh (Motion Template Engine)
// Dam bao nhan vat dong nhat 100%, buoc di tai cho chuan game 2D va chay tuc thi (<10ms)

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { PixelPoint } from '@pixel-draw/shared-types';

export interface TemplateAnimationOptions {
  action: string;
  frameCount: number;
  basePixels: PixelPoint[];
  width?: number;
  height?: number;
  outputPrefix: string;
}

export interface AnimationFrameItem {
  frameIndex: number;
  width: number;
  height: number;
  pixels: PixelPoint[];
  filename: string;
  imagePath: string;
}

export interface TemplateAnimationResult {
  frameCount: number;
  action: string;
  frames: AnimationFrameItem[];
  metaPath: string;
}

// Luu danh sach pixel ra file PNG
function savePixelsToPng(pixels: PixelPoint[], w: number, h: number, filePath: string) {
  const png = new PNG({ width: w, height: h });
  // Khoi tao trong suot hoan toan
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  for (const p of pixels) {
    if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h && p.color) {
      const idx = (w * p.y + p.x) << 2;
      const hex = p.color.replace('#', '');
      if (hex.length >= 6) {
        png.data[idx] = parseInt(hex.substring(0, 2), 16);
        png.data[idx + 1] = parseInt(hex.substring(2, 4), 16);
        png.data[idx + 2] = parseInt(hex.substring(4, 6), 16);
        png.data[idx + 3] = 255;
      }
    }
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

// Sinh chuoi hoat anh pixel bang thuat toan khung xuong
export function generateTemplateAnimation(opts: TemplateAnimationOptions): TemplateAnimationResult {
  const {
    action = 'walk',
    frameCount = 4,
    basePixels = [],
    width = 64,
    height = 64,
    outputPrefix
  } = opts;

  const outDir = path.dirname(outputPrefix);
  if (outDir && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Tinh toan hop gioi han (Bounding Box) cua nhan vat
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (const p of basePixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const charW = Math.max(1, maxX - minX + 1);
  const charH = Math.max(1, maxY - minY + 1);
  const centerX = Math.floor((minX + maxX) / 2);
  const legSplitY = minY + Math.floor(charH * 0.62);

  const frames: AnimationFrameItem[] = [];
  const frameFiles: string[] = [];

  const cleanAction = action.toLowerCase().trim();

  for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
    const framePixels: PixelPoint[] = [];
    const pixelMap = new Map<string, string>();

    const setPixel = (x: number, y: number, color: string | null | undefined) => {
      if (color && x >= 0 && x < width && y >= 0 && y < height) {
        pixelMap.set(`${x},${y}`, color);
      }
    };

    if (cleanAction === 'walk') {
      // Chu ky buoc di tai cho: than nguoi nhap nho Y, chan truoc sau lu luan
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const legSwing = Math.round(Math.sin(t) * 2);
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (p.y < legSplitY) {
          // Than tren nhap nho Y
          setPixel(p.x, p.y + bodyOffsetY, p.color);
        } else {
          // Chan trai hay phai
          if (p.x < centerX) {
            setPixel(p.x + legSwing, p.y, p.color);
          } else {
            setPixel(p.x - legSwing, p.y, p.color);
          }
        }
      }

    } else if (cleanAction === 'idle') {
      // Nhip tho nhe nhang: than tren ha xuong 1px o nua chu ky, chan giu nguyen diem neo
      const isBreathing = frameIdx % 2 === 1;
      const bodyOffsetY = isBreathing ? 1 : 0;

      for (const p of basePixels) {
        if (p.y < legSplitY) {
          setPixel(p.x, p.y + bodyOffsetY, p.color);
        } else {
          setPixel(p.x, p.y, p.color);
        }
      }

    } else if (cleanAction === 'attack' || cleanAction === 'slash') {
      // Hoat canh chem kiem: Frame 0 thu the, Frame 1 vung chem voi vet chem quang, Frame 2 thu the
      let bodyOffsetX = 0;
      let bodyOffsetY = 0;

      if (frameIdx === 0) {
        // Lay da lui ve sau
        bodyOffsetX = -1;
      } else if (frameIdx === 1) {
        // Ruon nguoi ve phia truoc
        bodyOffsetX = 1;
      } else {
        bodyOffsetX = 0;
      }

      for (const p of basePixels) {
        setPixel(p.x + bodyOffsetX, p.y + bodyOffsetY, p.color);
      }

      // Frame 1: Ve them vet chem quang (Slash Arc VFX)
      if (frameIdx === 1) {
        const arcCenterX = centerX + 4;
        const arcCenterY = minY + Math.floor(charH * 0.45);
        const radius = Math.max(10, Math.floor(charW * 0.7));

        // Quet vet chem hinh cung tron tu goc tren sau ra truoc
        for (let angleDeg = -80; angleDeg <= 60; angleDeg += 4) {
          const rad = (angleDeg * Math.PI) / 180;
          const arcX = Math.round(arcCenterX + Math.cos(rad) * radius);
          const arcY = Math.round(arcCenterY + Math.sin(rad) * radius);

          // Loi vet chem mau trang sang
          setPixel(arcX, arcY, '#ffffff');
          // Vien sang xung quanh mau xanh da troi neon
          setPixel(arcX - 1, arcY, '#67e8f9');
          setPixel(arcX, arcY - 1, '#38bdf8');
        }
      }

    } else if (cleanAction === 'jump') {
      // Nhay cao: Frame 0 trung goi, Frame 1 bay len cao, Frame 2 cham dat
      let jumpOffsetY = 0;
      if (frameIdx === 0) {
        jumpOffsetY = 2; // Crouch
      } else if (frameIdx === 1) {
        jumpOffsetY = -6; // Airborne
      } else if (frameIdx === 2) {
        jumpOffsetY = -4; // Apex
      } else {
        jumpOffsetY = 1; // Landing
      }

      for (const p of basePixels) {
        setPixel(p.x, p.y + jumpOffsetY, p.color);
      }

    } else if (cleanAction === 'run') {
      // Chay nhanh: sai buoc chan lon hon (+-3px) va than nghieng ve truoc
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const legSwing = Math.round(Math.sin(t) * 3);
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (p.y < legSplitY) {
          setPixel(p.x + 1, p.y + bodyOffsetY, p.color);
        } else {
          if (p.x < centerX) {
            setPixel(p.x + legSwing, p.y, p.color);
          } else {
            setPixel(p.x - legSwing, p.y, p.color);
          }
        }
      }

    } else if (cleanAction === 'sit') {
      // Ngoi nghi: ha thap than xuong 3 pixel
      const sitOffset = frameIdx === 0 ? 2 : 3;
      for (const p of basePixels) {
        setPixel(p.x, p.y + sitOffset, p.color);
      }

    } else if (cleanAction === 'defeated') {
      // Nam guc: nga nguoi xuong dat
      const fallOffset = frameIdx === 0 ? 2 : Math.floor(charH * 0.35);
      for (const p of basePixels) {
        setPixel(p.x, p.y + fallOffset, p.color);
      }

    } else {
      // Mac dinh: giu nguyen goc va nhap nho nhe
      const defBob = frameIdx % 2 === 1 ? -1 : 0;
      for (const p of basePixels) {
        setPixel(p.x, p.y + defBob, p.color);
      }
    }

    // Chuyen pixelMap thanh danh sach PixelPoint
    for (const [key, color] of pixelMap.entries()) {
      const [px, py] = key.split(',').map(Number);
      framePixels.push({ x: px, y: py, color });
    }

    // Luu file PNG cho frame
    const framePath = `${outputPrefix}_frame_${frameIdx}.png`;
    savePixelsToPng(framePixels, width, height, framePath);
    frameFiles.push(framePath);

    frames.push({
      frameIndex: frameIdx,
      width,
      height,
      pixels: framePixels,
      filename: path.basename(framePath),
      imagePath: framePath
    });
  }

  // Ghi file metadata JSON
  const metaData = {
    frameCount,
    action: cleanAction,
    engine: 'template',
    frameFiles,
    spriteSheetRaw: frameFiles[0]
  };

  const metaPath = `${outputPrefix}_anim_meta.json`;
  fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2), 'utf-8');

  return {
    frameCount,
    action: cleanAction,
    frames,
    metaPath
  };
}

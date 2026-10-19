// apps/server/src/template-animator.ts
// Bo tao hoat anh bang khung xuong va phep bien doi diem anh (Motion Template Engine)
// Dam bao nhan vat dong nhat 100%, buoc di tai cho chuan game 2D va chay tuc thi (<10ms)

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { PixelPoint, SkeletonRig, JointId, JointPin } from '@pixel-draw/shared-types';

export interface TemplateAnimationOptions {
  action: string;
  frameCount: number;
  basePixels: PixelPoint[];
  width?: number;
  height?: number;
  outputPrefix: string;
  skeletonRig?: SkeletonRig;
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
  skeletonRig?: SkeletonRig;
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

// Tu dong uoc luong khung xuong chuan giai phau dua tren Bounding Box cua nhan vat mau
export function autoEstimateSkeletonRig(
  basePixels: PixelPoint[],
  width = 64,
  height = 64
): SkeletonRig {
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

  // Truong hop chua co pixel nao, dung thong so mac dinh o giua khung hinh
  if (minX > maxX || minY > maxY) {
    minX = Math.floor(width * 0.25);
    maxX = Math.floor(width * 0.75);
    minY = Math.floor(height * 0.15);
    maxY = Math.floor(height * 0.85);
  }

  const charW = Math.max(1, maxX - minX + 1);
  const charH = Math.max(1, maxY - minY + 1);
  const centerX = Math.floor((minX + maxX) / 2);

  const headY = Math.max(0, minY + Math.floor(charH * 0.18));
  const chestY = Math.max(0, minY + Math.floor(charH * 0.40));
  const hipsY = Math.max(0, minY + Math.floor(charH * 0.60));
  const kneeY = Math.max(0, minY + Math.floor(charH * 0.80));
  const footY = Math.min(height - 1, maxY);

  const legSpacing = Math.max(2, Math.floor(charW * 0.22));

  const joints: Record<JointId, JointPin> = {
    head: { id: 'head', name: 'Đầu (Head)', x: centerX, y: headY, color: '#f59e0b', parent: 'chest' },
    chest: { id: 'chest', name: 'Ngực (Chest)', x: centerX, y: chestY, color: '#38bdf8' },
    hips: { id: 'hips', name: 'Hông (Hips)', x: centerX, y: hipsY, color: '#60a5fa', parent: 'chest' },
    left_knee: { id: 'left_knee', name: 'Gối Trái (L Knee)', x: Math.max(0, centerX - legSpacing), y: kneeY, color: '#4ade80', parent: 'hips' },
    left_foot: { id: 'left_foot', name: 'Bàn Chân Trái (L Foot)', x: Math.max(0, centerX - legSpacing), y: footY, color: '#22c55e', parent: 'left_knee' },
    right_knee: { id: 'right_knee', name: 'Gối Phải (R Knee)', x: Math.min(width - 1, centerX + legSpacing), y: kneeY, color: '#c084fc', parent: 'hips' },
    right_foot: { id: 'right_foot', name: 'Bàn Chân Phải (R Foot)', x: Math.min(width - 1, centerX + legSpacing), y: footY, color: '#a855f7', parent: 'right_knee' },
    weapon: { id: 'weapon', name: 'Vũ Khí / Tay (Weapon)', x: Math.min(width - 1, maxX + 2), y: Math.floor(minY + charH * 0.50), color: '#f43f5e', parent: 'chest' }
  };

  const bones: [JointId, JointId][] = [
    ['head', 'chest'],
    ['chest', 'hips'],
    ['hips', 'left_knee'],
    ['left_knee', 'left_foot'],
    ['hips', 'right_knee'],
    ['right_knee', 'right_foot'],
    ['chest', 'weapon']
  ];

  return {
    width,
    height,
    rootJoint: 'chest',
    joints,
    bones
  };
}

// Sinh chuoi hoat anh pixel bang thuat toan khung xuong va Soft-Skinning bien dang mem
export function generateTemplateAnimation(opts: TemplateAnimationOptions): TemplateAnimationResult {
  const {
    action = 'walk',
    frameCount = 4,
    basePixels = [],
    width = 64,
    height = 64,
    outputPrefix,
    skeletonRig
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

  // Lay khung xuong: su dung rig duoc truyen vao tu nguoi dung hoac tu dong tinh toan
  const rig = skeletonRig && rigHasValidJoints(skeletonRig)
    ? skeletonRig
    : autoEstimateSkeletonRig(basePixels, width, height);

  const chestY = rig.joints.chest?.y ?? (minY + Math.floor(charH * 0.40));
  const hipsY = rig.joints.hips?.y ?? (minY + Math.floor(charH * 0.60));
  const hipsX = rig.joints.hips?.x ?? centerX;

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

    // Danh sach cac diem pixel sau khi bien doi toa do
    interface TransformedPoint {
      origX: number;
      origY: number;
      targetX: number;
      targetY: number;
      color: string;
    }
    const mappedPoints: TransformedPoint[] = [];

    if (cleanAction === 'walk') {
      // Chu ky buoc di sinh hoc tu nhien:
      // - Than nhap nho theo nhip buoc chan
      // - Vung eo co gian mem (Soft Skinning) de khong bao gio bi dut gay
      // - Chan trai va chan phai xoay nguoc pha quanh khop hong
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const swingMag = 2.4;
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;

        if (p.y <= chestY) {
          // Than tren: nhap nho theo bodyOffsetY
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x,
            targetY: p.y + bodyOffsetY,
            color: p.color
          });
        } else if (p.y <= hipsY) {
          // Vung eo Soft-Skinning: noi suy mem tu bodyOffsetY ve 0 tai khop hong
          const blendFactor = (p.y - chestY) / Math.max(1, hipsY - chestY);
          const waistOffsetY = Math.round(bodyOffsetY * (1 - blendFactor));
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x,
            targetY: p.y + waistOffsetY,
            color: p.color
          });
        } else {
          // Vung chan: xoay quanh khop hong
          const isLeftLeg = p.x <= hipsX;
          const legProgress = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
          const legSwing = isLeftLeg ? Math.sin(t) * swingMag : -Math.sin(t) * swingMag;
          const swingDx = Math.round(legProgress * legSwing);

          // Nang chan nhe khi chan buoc ve truoc
          const isSwingingForward = isLeftLeg ? Math.sin(t) > 0 : -Math.sin(t) > 0;
          const liftAmount = isSwingingForward ? Math.abs(Math.sin(t)) * 1.5 : 0;
          const liftDy = -Math.round(legProgress * legProgress * liftAmount);

          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x + swingDx,
            targetY: p.y + liftDy,
            color: p.color
          });
        }
      }

    } else if (cleanAction === 'idle') {
      // Nhip tho nhe nhang: than tren ha xuong 1px o nua chu ky, khop hong va chan giu co dinh
      const isBreathing = frameIdx % 2 === 1;
      const bodyOffsetY = isBreathing ? 1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;
        if (p.y <= chestY) {
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x,
            targetY: p.y + bodyOffsetY,
            color: p.color
          });
        } else if (p.y <= hipsY) {
          const blendFactor = (p.y - chestY) / Math.max(1, hipsY - chestY);
          const waistOffsetY = Math.round(bodyOffsetY * (1 - blendFactor));
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x,
            targetY: p.y + waistOffsetY,
            color: p.color
          });
        } else {
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x,
            targetY: p.y,
            color: p.color
          });
        }
      }

    } else if (cleanAction === 'attack' || cleanAction === 'slash') {
      let bodyOffsetX = 0;
      let bodyOffsetY = 0;

      if (frameIdx === 0) {
        bodyOffsetX = -1; // Lay da lui ve sau
      } else if (frameIdx === 1) {
        bodyOffsetX = 1; // Ruon nguoi ve phia truoc
      } else {
        bodyOffsetX = 0;
      }

      for (const p of basePixels) {
        if (!p.color) continue;
        mappedPoints.push({
          origX: p.x,
          origY: p.y,
          targetX: p.x + bodyOffsetX,
          targetY: p.y + bodyOffsetY,
          color: p.color
        });
      }

      // Frame 1: Ve vet chem quang (Slash Arc VFX)
      if (frameIdx === 1) {
        const arcCenterX = centerX + 4;
        const arcCenterY = minY + Math.floor(charH * 0.45);
        const radius = Math.max(10, Math.floor(charW * 0.7));

        for (let angleDeg = -80; angleDeg <= 60; angleDeg += 4) {
          const rad = (angleDeg * Math.PI) / 180;
          const arcX = Math.round(arcCenterX + Math.cos(rad) * radius);
          const arcY = Math.round(arcCenterY + Math.sin(rad) * radius);

          setPixel(arcX, arcY, '#ffffff');
          setPixel(arcX - 1, arcY, '#67e8f9');
          setPixel(arcX, arcY - 1, '#38bdf8');
        }
      }

    } else if (cleanAction === 'jump') {
      let jumpOffsetY = 0;
      if (frameIdx === 0) {
        jumpOffsetY = 2; // Crouch
      } else if (frameIdx === 1) {
        jumpOffsetY = -5; // Airborne
      } else if (frameIdx === 2) {
        jumpOffsetY = -3; // Apex
      } else {
        jumpOffsetY = 1; // Landing
      }

      for (const p of basePixels) {
        if (!p.color) continue;
        mappedPoints.push({
          origX: p.x,
          origY: p.y,
          targetX: p.x,
          targetY: p.y + jumpOffsetY,
          color: p.color
        });
      }

    } else if (cleanAction === 'run') {
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const swingMag = 3.2;
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;
        if (p.y <= chestY) {
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x + 1,
            targetY: p.y + bodyOffsetY,
            color: p.color
          });
        } else if (p.y <= hipsY) {
          const blendFactor = (p.y - chestY) / Math.max(1, hipsY - chestY);
          const waistOffsetY = Math.round(bodyOffsetY * (1 - blendFactor));
          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x + 1,
            targetY: p.y + waistOffsetY,
            color: p.color
          });
        } else {
          const isLeftLeg = p.x <= hipsX;
          const legProgress = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
          const legSwing = isLeftLeg ? Math.sin(t) * swingMag : -Math.sin(t) * swingMag;
          const swingDx = Math.round(legProgress * legSwing);

          mappedPoints.push({
            origX: p.x,
            origY: p.y,
            targetX: p.x + swingDx,
            targetY: p.y,
            color: p.color
          });
        }
      }

    } else {
      const defBob = frameIdx % 2 === 1 ? -1 : 0;
      for (const p of basePixels) {
        if (!p.color) continue;
        mappedPoints.push({
          origX: p.x,
          origY: p.y,
          targetX: p.x,
          targetY: p.y + defBob,
          color: p.color
        });
      }
    }

    // 1. Gan cac diem da bien doi vao pixelMap
    for (const pt of mappedPoints) {
      setPixel(pt.targetX, pt.targetY, pt.color);
    }

    // 2. Thuat toan chong ho eo / ran nut pixel (Anti-Gap Column Interpolation):
    // Neu hai pixel lien ke ban dau trong cung 1 cot bi keo dan xa nhau, tu dong lap day khoang trong
    const columnMap = new Map<number, TransformedPoint[]>();
    for (const pt of mappedPoints) {
      if (!columnMap.has(pt.origX)) {
        columnMap.set(pt.origX, []);
      }
      columnMap.get(pt.origX)!.push(pt);
    }

    for (const [, colPoints] of columnMap.entries()) {
      colPoints.sort((a, b) => a.origY - b.origY);
      for (let i = 0; i < colPoints.length - 1; i++) {
        const cur = colPoints[i];
        const next = colPoints[i + 1];

        // Neu ban dau hai pixel nam sat nhau theo chieu Y
        if (next.origY === cur.origY + 1) {
          // Neu do keo dan lam xuat hien khe ho Y
          if (next.targetY > cur.targetY + 1) {
            for (let fillY = cur.targetY + 1; fillY < next.targetY; fillY++) {
              setPixel(cur.targetX, fillY, cur.color);
            }
          }
          // Neu co do lech ngang giua hai dong sat nhau vuot qua 1 pixel
          if (Math.abs(next.targetX - cur.targetX) > 1) {
            const stepX = next.targetX > cur.targetX ? 1 : -1;
            for (let fillX = cur.targetX + stepX; fillX !== next.targetX; fillX += stepX) {
              setPixel(fillX, cur.targetY, cur.color);
            }
          }
        }
      }
    }

    // Chuyen pixelMap thanh danh sach PixelPoint
    for (const [key, color] of pixelMap.entries()) {
      const [px, py] = key.split(',').map(Number);
      framePixels.push({ x: px, y: py, color });
    }

    // Luu file PNG cho tung frame
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
    spriteSheetRaw: frameFiles[0],
    skeletonRig: rig
  };

  const metaPath = `${outputPrefix}_anim_meta.json`;
  fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2), 'utf-8');

  return {
    frameCount,
    action: cleanAction,
    frames,
    metaPath,
    skeletonRig: rig
  };
}

// Ham kiem tra khung xuong co day du cac khop co ban khong
function rigHasValidJoints(rig: SkeletonRig): boolean {
  return !!(rig && rig.joints && rig.joints.chest && rig.joints.hips);
}

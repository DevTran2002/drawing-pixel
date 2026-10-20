// apps/server/src/template-animator.ts
// Bo tao hoat anh bang khung xuong xoay quanh tam (Hierarchical Pivot Rotation & Joint Stitching)
// Bao toan 100% diem anh goc cua nhan vat, chuyen dong game 2D muot ma, khong xe rach

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
  slashVfxType?: 'none' | 'cyan' | 'fire' | 'silver' | 'purple';
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
export function savePixelsToPng(pixels: PixelPoint[], w: number, h: number, filePath: string): void {
  const png = new PNG({ width: w, height: h });
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

// Ham xoay diem quanh pivot
export function rotatePoint(x: number, y: number, ox: number, oy: number, angleRad: number): { x: number; y: number } {
  if (Math.abs(angleRad) < 1e-4) return { x, y };
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rx = ox + (x - ox) * cos - (y - oy) * sin;
  const ry = oy + (x - ox) * sin + (y - oy) * cos;
  return { x: Math.round(rx), y: Math.round(ry) };
}

// Doan thang Bresenham de noi pixel lang gieng triet tieu khe ho
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

// Nhan dien pixel mau xanh tap de de khong bi nham vao canh tay
function isBlueApronColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '');
  if (clean.length < 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return b > 100 && b > r * 1.3 && b > g * 1.15;
}

// Tu dong uoc luong khung xuong OpenPose Full chuan giai phau dua tren Bounding Box cua nhan vat mau
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

  if (minX > maxX || minY > maxY) {
    minX = Math.floor(width * 0.25);
    maxX = Math.floor(width * 0.75);
    minY = Math.floor(height * 0.15);
    maxY = Math.floor(height * 0.85);
  }

  const charW = Math.max(1, maxX - minX + 1);
  const charH = Math.max(1, maxY - minY + 1);
  const centerX = Math.floor((minX + maxX) / 2);

  const headY = Math.max(0, minY + Math.floor(charH * 0.12));
  const neckY = Math.max(0, minY + Math.floor(charH * 0.25));
  const chestY = Math.max(0, minY + Math.floor(charH * 0.38));
  const hipsY = Math.max(0, minY + Math.floor(charH * 0.72));

  const armSpan = Math.max(3, Math.floor(charW * 0.28));
  const elbowSpan = Math.max(4, Math.floor(charW * 0.36));
  const wristSpan = Math.max(4, Math.floor(charW * 0.38));
  const elbowY = Math.max(0, minY + Math.floor(charH * 0.44));
  const wristY = Math.max(0, minY + Math.floor(charH * 0.58));

  const hipSpan = Math.max(2, Math.floor(charW * 0.16));
  const kneeSpan = Math.max(2, Math.floor(charW * 0.20));
  const kneeY = Math.max(0, minY + Math.floor(charH * 0.85));
  const footY = Math.min(height - 1, maxY);

  const joints: Record<string, JointPin> = {
    head: { id: 'head', name: 'Đầu (Head)', x: centerX, y: headY, color: '#ec4899', parent: 'neck' },
    neck: { id: 'neck', name: 'Cổ (Neck)', x: centerX, y: neckY, color: '#f59e0b', parent: 'chest' },
    chest: { id: 'chest', name: 'Ngực (Chest)', x: centerX, y: chestY, color: '#38bdf8' },
    hips: { id: 'hips', name: 'Hông (Hips)', x: centerX, y: hipsY, color: '#0284c7', parent: 'chest' },
    left_shoulder: { id: 'left_shoulder', name: 'Vai Trái (L Shoulder)', x: Math.max(0, centerX - armSpan), y: neckY + 1, color: '#f97316', parent: 'neck' },
    left_elbow: { id: 'left_elbow', name: 'Khuỷu Trái (L Elbow)', x: Math.max(0, centerX - elbowSpan), y: elbowY, color: '#eab308', parent: 'left_shoulder' },
    left_wrist: { id: 'left_wrist', name: 'Cổ Tay Trái (L Wrist)', x: Math.max(0, centerX - wristSpan), y: wristY, color: '#fde047', parent: 'left_elbow' },
    right_shoulder: { id: 'right_shoulder', name: 'Vai Phải (R Shoulder)', x: Math.min(width - 1, centerX + armSpan), y: neckY + 1, color: '#84cc16', parent: 'neck' },
    right_elbow: { id: 'right_elbow', name: 'Khuỷu Phải (R Elbow)', x: Math.min(width - 1, centerX + elbowSpan), y: elbowY, color: '#22c55e', parent: 'right_shoulder' },
    right_wrist: { id: 'right_wrist', name: 'Cổ Tay Phải (R Wrist)', x: Math.min(width - 1, centerX + wristSpan), y: wristY, color: '#4ade80', parent: 'right_elbow' },
    left_hip: { id: 'left_hip', name: 'Háng Trái (L Hip)', x: Math.max(0, centerX - hipSpan), y: hipsY + 1, color: '#06b6d4', parent: 'hips' },
    left_knee: { id: 'left_knee', name: 'Gối Trái (L Knee)', x: Math.max(0, centerX - kneeSpan), y: kneeY, color: '#38bdf8', parent: 'left_hip' },
    left_foot: { id: 'left_foot', name: 'Bàn Chân Trái (L Foot)', x: Math.max(0, centerX - kneeSpan), y: footY, color: '#60a5fa', parent: 'left_knee' },
    right_hip: { id: 'right_hip', name: 'Háng Phải (R Hip)', x: Math.min(width - 1, centerX + hipSpan), y: hipsY + 1, color: '#8b5cf6', parent: 'hips' },
    right_knee: { id: 'right_knee', name: 'Gối Phải (R Knee)', x: Math.min(width - 1, centerX + kneeSpan), y: kneeY, color: '#a855f7', parent: 'right_hip' },
    right_foot: { id: 'right_foot', name: 'Bàn Chân Phải (R Foot)', x: Math.min(width - 1, centerX + kneeSpan), y: footY, color: '#c084fc', parent: 'right_knee' },
    weapon: { id: 'weapon', name: 'Vũ Khí (Weapon)', x: Math.min(width - 1, maxX + 2), y: Math.floor(minY + charH * 0.50), color: '#f43f5e', parent: 'right_wrist' }
  };

  const bones: [string, string][] = [
    ['head', 'neck'],
    ['neck', 'chest'],
    ['chest', 'hips'],
    ['neck', 'left_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['neck', 'right_shoulder'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['hips', 'left_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_foot'],
    ['hips', 'right_hip'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_foot'],
    ['right_wrist', 'weapon']
  ];

  return {
    width,
    height,
    rootJoint: 'chest',
    joints,
    bones
  };
}

export type AnatomicalPart =
  | 'HEAD'
  | 'TORSO'          // Toan bo nguc, eo, tap de va tui ao (Bao toan nguyen ven!)
  | 'LEFT_ARM_UPPER'
  | 'LEFT_ARM_LOWER'
  | 'RIGHT_ARM_UPPER'
  | 'RIGHT_ARM_LOWER'
  | 'LEFT_LEG_UPPER'
  | 'LEFT_LEG_LOWER'
  | 'RIGHT_LEG_UPPER'
  | 'RIGHT_LEG_LOWER';

// Sinh chuoi hoat anh pixel bang he thong xoay khop dong hoc va khau lien vet rach
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

  const rig = skeletonRig && rigHasValidJoints(skeletonRig)
    ? skeletonRig
    : autoEstimateSkeletonRig(basePixels, width, height);

  // Cac moc giai phau co the dua tren ty le vang
  const headEndY = minY + Math.round(charH * 0.35);   // Ket thuc dau
  const neckY = minY + Math.round(charH * 0.38);      // Co va Vai

  // Tu dong phat hien gau vay / gau tap de dua tren su chuyen tiep mat do pixel sang 2 chan
  const yCounts = new Array(height).fill(0);
  for (const p of basePixels) {
    if (p.y >= 0 && p.y < height) yCounts[p.y]++;
  }

  let skirtEndY = minY + Math.round(charH * 0.70);    // Mac dinh 70% chieu cao
  for (let y = headEndY + 4; y <= minY + Math.round(charH * 0.78); y++) {
    if (yCounts[y] <= 14 && yCounts[y - 1] > 16) {
      skirtEndY = y - 1;
      break;
    }
  }

  const kneeY = minY + Math.round(charH * 0.86);      // Dau goi
  const elbowY = minY + Math.round(charH * 0.48);     // Khuu tay
  const armWidthLimit = Math.max(3, Math.round(charW * 0.22));

  const shoulderY = neckY + 1;
  const leftShoulderX = centerX - armWidthLimit;
  const rightShoulderX = centerX + armWidthLimit;
  const leftElbowX = leftShoulderX - 2;
  const rightElbowX = rightShoulderX + 2;

  const hipY = skirtEndY;
  const leftHipX = centerX - Math.max(2, Math.round(charW * 0.16));
  const rightHipX = centerX + Math.max(2, Math.round(charW * 0.16));
  const leftKneeX = leftHipX;
  const rightKneeX = rightHipX;

  // Phan loai tung pixel dua tren giai phau tong quat khong phu thuoc mau ao
  const classifyPixel = (p: PixelPoint): AnatomicalPart => {
    // 1. Dau va Co
    if (p.y <= headEndY) {
      return 'HEAD';
    }

    // 2. Than va Vay/Tap de (Tu co den het gau vay)
    if (p.y <= skirtEndY) {
      // Mau xanh tap de luon thuoc ve Than (TORSO)
      if (isBlueApronColor(p.color)) {
        return 'TORSO';
      }

      // Canh tay chi tach ra khoi than o vung vai va khuu tay tren (p.y <= elbowY + 3)
      // Vung vay phong ben duoi luon thuoc ve TORSO de khong bao gio bi xe rach
      if (p.y <= elbowY + 3) {
        if (p.x < leftShoulderX) {
          return p.y <= elbowY ? 'LEFT_ARM_UPPER' : 'LEFT_ARM_LOWER';
        }
        if (p.x > rightShoulderX) {
          return p.y <= elbowY ? 'RIGHT_ARM_UPPER' : 'RIGHT_ARM_LOWER';
        }
      }
      return 'TORSO';
    }

    // 3. Hai chan (Duoi gau vay / quan)
    if (p.x <= centerX) {
      return p.y <= kneeY ? 'LEFT_LEG_UPPER' : 'LEFT_LEG_LOWER';
    } else {
      return p.y <= kneeY ? 'RIGHT_LEG_UPPER' : 'RIGHT_LEG_LOWER';
    }
  };

  const origPixelMap = new Map<string, PixelPoint>();
  for (const p of basePixels) {
    origPixelMap.set(`${p.x},${p.y}`, p);
  }

  interface NeighborLink {
    p1: PixelPoint;
    p2: PixelPoint;
    part: AnatomicalPart;
  }
  const links: NeighborLink[] = [];
  const partMap = new Map<string, AnatomicalPart>();

  for (const p of basePixels) {
    const part = classifyPixel(p);
    partMap.set(`${p.x},${p.y}`, part);
  }

  // Tao danh sach lien ket lang gieng giua cac pixel cung bo phan de bao toan khong bi ho
  for (const p of basePixels) {
    const part = partMap.get(`${p.x},${p.y}`)!;
    const rightP = origPixelMap.get(`${p.x + 1},${p.y}`);
    if (rightP && partMap.get(`${rightP.x},${rightP.y}`) === part) {
      links.push({ p1: p, p2: rightP, part });
    }
    const bottomP = origPixelMap.get(`${p.x},${p.y + 1}`);
    if (bottomP && partMap.get(`${bottomP.x},${bottomP.y}`) === part) {
      links.push({ p1: p, p2: bottomP, part });
    }
  }

  const frames: AnimationFrameItem[] = [];
  const frameFiles: string[] = [];
  const cleanAction = action.toLowerCase().trim();

  for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
    const pixelMap = new Map<string, string>();
    const setPixel = (x: number, y: number, color: string | null | undefined) => {
      if (color && x >= 0 && x < width && y >= 0 && y < height) {
        pixelMap.set(`${x},${y}`, color);
      }
    };

    let bodyDx = 0;
    let bodyDy = 0;

    let leftShoulderAngle = 0;
    let leftElbowAngle = 0;
    let rightShoulderAngle = 0;
    let rightElbowAngle = 0;

    let leftHipAngle = 0;
    let leftKneeAngle = 0;
    let rightHipAngle = 0;
    let rightKneeAngle = 0;

    let drawSlashVfx = false;

    // Goc dong hoc toi uu cho tung hanh dong
    if (cleanAction === 'walk') {
      const isBob = frameIdx % 2 === 1;
      bodyDy = isBob ? -1 : 0;

      if (frameIdx === 0) {
        leftHipAngle = (22 * Math.PI) / 180;
        leftKneeAngle = (8 * Math.PI) / 180;
        rightHipAngle = (-22 * Math.PI) / 180;
        rightKneeAngle = (-15 * Math.PI) / 180;
        rightShoulderAngle = (24 * Math.PI) / 180;
        rightElbowAngle = (10 * Math.PI) / 180;
        leftShoulderAngle = (-24 * Math.PI) / 180;
        leftElbowAngle = (-10 * Math.PI) / 180;
      } else if (frameIdx === 1) {
        leftHipAngle = 0;
        leftKneeAngle = 0;
        rightHipAngle = (12 * Math.PI) / 180;
        rightKneeAngle = (-30 * Math.PI) / 180;
        rightShoulderAngle = (6 * Math.PI) / 180;
        leftShoulderAngle = (-6 * Math.PI) / 180;
      } else if (frameIdx === 2) {
        leftHipAngle = (-22 * Math.PI) / 180;
        leftKneeAngle = (-15 * Math.PI) / 180;
        rightHipAngle = (22 * Math.PI) / 180;
        rightKneeAngle = (8 * Math.PI) / 180;
        rightShoulderAngle = (-24 * Math.PI) / 180;
        rightElbowAngle = (-10 * Math.PI) / 180;
        leftShoulderAngle = (24 * Math.PI) / 180;
        leftElbowAngle = (10 * Math.PI) / 180;
      } else {
        rightHipAngle = 0;
        rightKneeAngle = 0;
        leftHipAngle = (12 * Math.PI) / 180;
        leftKneeAngle = (-30 * Math.PI) / 180;
        rightShoulderAngle = (-6 * Math.PI) / 180;
        leftShoulderAngle = (6 * Math.PI) / 180;
      }

    } else if (cleanAction === 'run') {
      bodyDx = 1;
      const isBob = frameIdx % 2 === 1;
      bodyDy = isBob ? -1 : 0;

      if (frameIdx === 0) {
        leftHipAngle = (32 * Math.PI) / 180;
        leftKneeAngle = (12 * Math.PI) / 180;
        rightHipAngle = (-32 * Math.PI) / 180;
        rightKneeAngle = (-35 * Math.PI) / 180;
        rightShoulderAngle = (38 * Math.PI) / 180;
        rightElbowAngle = (25 * Math.PI) / 180;
        leftShoulderAngle = (-38 * Math.PI) / 180;
        leftElbowAngle = (-15 * Math.PI) / 180;
      } else if (frameIdx === 1) {
        leftHipAngle = (5 * Math.PI) / 180;
        leftKneeAngle = 0;
        rightHipAngle = (18 * Math.PI) / 180;
        rightKneeAngle = (-45 * Math.PI) / 180;
        rightShoulderAngle = (12 * Math.PI) / 180;
        leftShoulderAngle = (-12 * Math.PI) / 180;
      } else if (frameIdx === 2) {
        leftHipAngle = (-32 * Math.PI) / 180;
        leftKneeAngle = (-35 * Math.PI) / 180;
        rightHipAngle = (32 * Math.PI) / 180;
        rightKneeAngle = (12 * Math.PI) / 180;
        rightShoulderAngle = (-38 * Math.PI) / 180;
        rightElbowAngle = (-15 * Math.PI) / 180;
        leftShoulderAngle = (38 * Math.PI) / 180;
        leftElbowAngle = (25 * Math.PI) / 180;
      } else {
        rightHipAngle = (5 * Math.PI) / 180;
        rightKneeAngle = 0;
        leftHipAngle = (18 * Math.PI) / 180;
        leftKneeAngle = (-45 * Math.PI) / 180;
        rightShoulderAngle = (-12 * Math.PI) / 180;
        leftShoulderAngle = (12 * Math.PI) / 180;
      }

    } else if (cleanAction === 'jump') {
      if (frameIdx === 0) {
        // Nhun lay da
        bodyDy = 2;
        leftHipAngle = (14 * Math.PI) / 180;
        leftKneeAngle = (-35 * Math.PI) / 180;
        rightHipAngle = (-12 * Math.PI) / 180;
        rightKneeAngle = (-30 * Math.PI) / 180;
        rightShoulderAngle = (-15 * Math.PI) / 180;
        leftShoulderAngle = (-15 * Math.PI) / 180;
      } else if (frameIdx === 1) {
        // Bat len khong
        bodyDy = -6;
        leftHipAngle = 0;
        leftKneeAngle = 0;
        rightHipAngle = 0;
        rightKneeAngle = 0;
        rightShoulderAngle = (-35 * Math.PI) / 180;
        leftShoulderAngle = (-35 * Math.PI) / 180;
      } else if (frameIdx === 2) {
        // Dinh cao nhat
        bodyDy = -5;
        leftHipAngle = (22 * Math.PI) / 180;
        leftKneeAngle = (-50 * Math.PI) / 180;
        rightHipAngle = (-16 * Math.PI) / 180;
        rightKneeAngle = (-45 * Math.PI) / 180;
        rightShoulderAngle = (-20 * Math.PI) / 180;
        leftShoulderAngle = (-20 * Math.PI) / 180;
      } else {
        // Tiep dat
        bodyDy = 2;
        leftHipAngle = (12 * Math.PI) / 180;
        leftKneeAngle = (-25 * Math.PI) / 180;
        rightHipAngle = (-10 * Math.PI) / 180;
        rightKneeAngle = (-20 * Math.PI) / 180;
        rightShoulderAngle = (8 * Math.PI) / 180;
        leftShoulderAngle = (8 * Math.PI) / 180;
      }

    } else if (cleanAction === 'attack' || cleanAction === 'slash') {
      if (frameIdx === 0) {
        // Gio kiem lay da
        bodyDx = -1;
        rightShoulderAngle = (-50 * Math.PI) / 180;
        rightElbowAngle = (-35 * Math.PI) / 180;
        leftShoulderAngle = (18 * Math.PI) / 180;
        leftHipAngle = (8 * Math.PI) / 180;
        rightHipAngle = (-8 * Math.PI) / 180;
      } else if (frameIdx === 1) {
        // Chem manh ve truoc
        bodyDx = 3;
        bodyDy = 1;
        rightShoulderAngle = (40 * Math.PI) / 180;
        rightElbowAngle = (12 * Math.PI) / 180;
        leftShoulderAngle = (-22 * Math.PI) / 180;
        leftHipAngle = (18 * Math.PI) / 180;
        leftKneeAngle = (-12 * Math.PI) / 180;
        rightHipAngle = (-20 * Math.PI) / 180;
        drawSlashVfx = true;
      } else if (frameIdx === 2) {
        // Theo da
        bodyDx = 2;
        bodyDy = 1;
        rightShoulderAngle = (60 * Math.PI) / 180;
        rightElbowAngle = (5 * Math.PI) / 180;
        leftShoulderAngle = (-12 * Math.PI) / 180;
        leftHipAngle = (10 * Math.PI) / 180;
        rightHipAngle = (-12 * Math.PI) / 180;
      } else {
        // Thu kiem
        rightShoulderAngle = (10 * Math.PI) / 180;
        rightElbowAngle = (15 * Math.PI) / 180;
      }

    } else if (cleanAction === 'sit') {
      bodyDy = 6;
      leftHipAngle = (65 * Math.PI) / 180;
      leftKneeAngle = (-75 * Math.PI) / 180;
      rightHipAngle = (65 * Math.PI) / 180;
      rightKneeAngle = (-75 * Math.PI) / 180;

    } else if (cleanAction === 'defeated') {
      if (frameIdx === 0) {
        bodyDy = 3;
        leftHipAngle = (25 * Math.PI) / 180;
      } else {
        bodyDy = 7;
        leftHipAngle = (10 * Math.PI) / 180;
      }

    } else {
      // Idle: tho nhe
      const isBreath = frameIdx % 2 === 1;
      bodyDy = isBreath ? 1 : 0;
    }

    const curLeftElbow = rotatePoint(leftElbowX, elbowY, leftShoulderX, shoulderY, leftShoulderAngle);
    const curRightElbow = rotatePoint(rightElbowX, elbowY, rightShoulderX, shoulderY, rightShoulderAngle);
    const curLeftKnee = rotatePoint(leftKneeX, kneeY, leftHipX, hipY, leftHipAngle);
    const curRightKnee = rotatePoint(rightKneeX, kneeY, rightHipX, hipY, rightHipAngle);

    const transformPt = (p: PixelPoint, part: AnatomicalPart): { tx: number; ty: number } => {
      switch (part) {
        case 'HEAD':
        case 'TORSO':
          return { tx: p.x + bodyDx, ty: p.y + bodyDy };
        case 'LEFT_ARM_UPPER': {
          const pt = rotatePoint(p.x, p.y, leftShoulderX, shoulderY, leftShoulderAngle);
          return { tx: pt.x + bodyDx, ty: pt.y + bodyDy };
        }
        case 'LEFT_ARM_LOWER': {
          const pt1 = rotatePoint(p.x, p.y, leftShoulderX, shoulderY, leftShoulderAngle);
          const pt2 = rotatePoint(pt1.x, pt1.y, curLeftElbow.x, curLeftElbow.y, leftElbowAngle);
          return { tx: pt2.x + bodyDx, ty: pt2.y + bodyDy };
        }
        case 'RIGHT_ARM_UPPER': {
          const pt = rotatePoint(p.x, p.y, rightShoulderX, shoulderY, rightShoulderAngle);
          return { tx: pt.x + bodyDx, ty: pt.y + bodyDy };
        }
        case 'RIGHT_ARM_LOWER': {
          const pt1 = rotatePoint(p.x, p.y, rightShoulderX, shoulderY, rightShoulderAngle);
          const pt2 = rotatePoint(pt1.x, pt1.y, curRightElbow.x, curRightElbow.y, rightElbowAngle);
          return { tx: pt2.x + bodyDx, ty: pt2.y + bodyDy };
        }
        case 'LEFT_LEG_UPPER': {
          const pt = rotatePoint(p.x, p.y, leftHipX, hipY, leftHipAngle);
          return { tx: pt.x, ty: pt.y + bodyDy };
        }
        case 'LEFT_LEG_LOWER': {
          const pt1 = rotatePoint(p.x, p.y, leftHipX, hipY, leftHipAngle);
          const pt2 = rotatePoint(pt1.x, pt1.y, curLeftKnee.x, curLeftKnee.y, leftKneeAngle);
          return { tx: pt2.x, ty: pt2.y + bodyDy };
        }
        case 'RIGHT_LEG_UPPER': {
          const pt = rotatePoint(p.x, p.y, rightHipX, hipY, rightHipAngle);
          return { tx: pt.x, ty: pt.y + bodyDy };
        }
        case 'RIGHT_LEG_LOWER': {
          const pt1 = rotatePoint(p.x, p.y, rightHipX, hipY, rightHipAngle);
          const pt2 = rotatePoint(pt1.x, pt1.y, curRightKnee.x, curRightKnee.y, rightKneeAngle);
          return { tx: pt2.x, ty: pt2.y + bodyDy };
        }
      }
    };

    // 1. Dat cac pixel goc da bien doi
    for (const p of basePixels) {
      const part = partMap.get(`${p.x},${p.y}`)!;
      const trans = transformPt(p, part);
      setPixel(trans.tx, trans.ty, p.color);
    }

    // 2. Bao ton lien ket lang gieng Bresenham
    for (const link of links) {
      const t1 = transformPt(link.p1, link.part);
      const t2 = transformPt(link.p2, link.part);
      const dist = Math.hypot(t2.tx - t1.tx, t2.ty - t1.ty);
      if (dist > 1.2 && dist <= 3.8) {
        const line = bresenhamLine(t1.tx, t1.ty, t2.tx, t2.ty);
        for (const pt of line) {
          setPixel(pt.x, pt.y, link.p1.color);
        }
      }
    }

    // 3. Khau cau noi gau vay/tap de -> Dui chan (tranh ho chan)
    for (let hx = leftHipX - 3; hx <= rightHipX + 3; hx++) {
      const topColor = pixelMap.get(`${hx},${hipY + bodyDy}`);
      if (topColor && !pixelMap.has(`${hx},${hipY + bodyDy + 1}`)) {
        setPixel(hx, hipY + bodyDy + 1, topColor);
      }
    }

    // 4. Ve vet chem quang (Slash VFX Arc) tuy bien theo nguyen to hoac tat
    const vfxType = opts.slashVfxType ?? 'cyan';
    if (drawSlashVfx && vfxType !== 'none') {
      const vfxCenterX = centerX + 6 + bodyDx;
      const vfxCenterY = neckY + 4 + bodyDy;
      const radius = Math.min(22, Math.max(16, Math.round(charW * 0.42)));

      let coreColor = '#ffffff';
      let mainColor = '#67e8f9';
      let edgeColor = '#38bdf8';
      let lightColor = '#a5f3fc';

      if (vfxType === 'silver') {
        // Vet chem vat ly thep/bac truyen thong
        coreColor = '#ffffff';
        mainColor = '#e2e8f0';
        edgeColor = '#94a3b8';
        lightColor = '#f8fafc';
      } else if (vfxType === 'fire') {
        // Vet chem lua / cuong no
        coreColor = '#fef08a';
        mainColor = '#f97316';
        edgeColor = '#ef4444';
        lightColor = '#fde047';
      } else if (vfxType === 'purple') {
        // Vet chem bong toi / hu khong
        coreColor = '#f5d0fe';
        mainColor = '#c084fc';
        edgeColor = '#9333ea';
        lightColor = '#f0abfc';
      }

      for (let aDeg = -30; aDeg <= 55; aDeg += 2) {
        const aRad = (aDeg * Math.PI) / 180;
        const vx = Math.round(vfxCenterX + Math.cos(aRad) * radius);
        const vy = Math.round(vfxCenterY + Math.sin(aRad) * radius);

        setPixel(vx, vy, coreColor);
        setPixel(vx - 1, vy, mainColor);
        setPixel(vx, vy - 1, edgeColor);
        setPixel(vx + 1, vy, lightColor);
      }
    }

    // 5. Don dep pixel co lap (Stray Pixel Cleaner)
    const keys = Array.from(pixelMap.keys());
    for (const key of keys) {
      const [px, py] = key.split(',').map(Number);
      // Kiem tra 8 o xung quanh
      let neighborCount = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (ox === 0 && oy === 0) continue;
          if (pixelMap.has(`${px + ox},${py + oy}`)) {
            neighborCount++;
          }
        }
      }
      if (neighborCount === 0) {
        pixelMap.delete(key);
      }
    }

    const framePixels: PixelPoint[] = [];
    for (const [key, color] of pixelMap.entries()) {
      const [px, py] = key.split(',').map(Number);
      framePixels.push({ x: px, y: py, color });
    }

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

function rigHasValidJoints(rig: SkeletonRig): boolean {
  return !!(rig && rig.joints && rig.joints.chest && rig.joints.hips);
}

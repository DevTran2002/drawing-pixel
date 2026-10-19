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

  const headY = Math.max(0, minY + Math.floor(charH * 0.12));
  const neckY = Math.max(0, minY + Math.floor(charH * 0.25));
  const chestY = Math.max(0, minY + Math.floor(charH * 0.38));
  const hipsY = Math.max(0, minY + Math.floor(charH * 0.58));

  // Canh tay
  const armSpan = Math.max(3, Math.floor(charW * 0.28));
  const elbowSpan = Math.max(4, Math.floor(charW * 0.36));
  const wristSpan = Math.max(4, Math.floor(charW * 0.38));
  const elbowY = Math.max(0, minY + Math.floor(charH * 0.44));
  const wristY = Math.max(0, minY + Math.floor(charH * 0.58));

  // Chan
  const hipSpan = Math.max(2, Math.floor(charW * 0.16));
  const kneeSpan = Math.max(2, Math.floor(charW * 0.20));
  const kneeY = Math.max(0, minY + Math.floor(charH * 0.78));
  const footY = Math.min(height - 1, maxY);

  const joints: Record<string, JointPin> = {
    // Dau & Co (OpenPose #ec4899 / #f59e0b)
    head: { id: 'head', name: 'Đầu (Head)', x: centerX, y: headY, color: '#ec4899', parent: 'neck' },
    neck: { id: 'neck', name: 'Cổ (Neck)', x: centerX, y: neckY, color: '#f59e0b', parent: 'chest' },
    // Than
    chest: { id: 'chest', name: 'Ngực (Chest)', x: centerX, y: chestY, color: '#38bdf8' },
    hips: { id: 'hips', name: 'Hông (Hips)', x: centerX, y: hipsY, color: '#0284c7', parent: 'chest' },
    // Tay Trai (Vang Cam OpenPose)
    left_shoulder: { id: 'left_shoulder', name: 'Vai Trái (L Shoulder)', x: Math.max(0, centerX - armSpan), y: neckY + 1, color: '#f97316', parent: 'neck' },
    left_elbow: { id: 'left_elbow', name: 'Khuỷu Trái (L Elbow)', x: Math.max(0, centerX - elbowSpan), y: elbowY, color: '#eab308', parent: 'left_shoulder' },
    left_wrist: { id: 'left_wrist', name: 'Cổ Tay Trái (L Wrist)', x: Math.max(0, centerX - wristSpan), y: wristY, color: '#fde047', parent: 'left_elbow' },
    // Tay Phai (Xanh La OpenPose)
    right_shoulder: { id: 'right_shoulder', name: 'Vai Phải (R Shoulder)', x: Math.min(width - 1, centerX + armSpan), y: neckY + 1, color: '#84cc16', parent: 'neck' },
    right_elbow: { id: 'right_elbow', name: 'Khuỷu Phải (R Elbow)', x: Math.min(width - 1, centerX + elbowSpan), y: elbowY, color: '#22c55e', parent: 'right_shoulder' },
    right_wrist: { id: 'right_wrist', name: 'Cổ Tay Phải (R Wrist)', x: Math.min(width - 1, centerX + wristSpan), y: wristY, color: '#4ade80', parent: 'right_elbow' },
    // Chan Trai (Xanh Lam OpenPose)
    left_hip: { id: 'left_hip', name: 'Háng Trái (L Hip)', x: Math.max(0, centerX - hipSpan), y: hipsY + 1, color: '#06b6d4', parent: 'hips' },
    left_knee: { id: 'left_knee', name: 'Gối Trái (L Knee)', x: Math.max(0, centerX - kneeSpan), y: kneeY, color: '#38bdf8', parent: 'left_hip' },
    left_foot: { id: 'left_foot', name: 'Bàn Chân Trái (L Foot)', x: Math.max(0, centerX - kneeSpan), y: footY, color: '#60a5fa', parent: 'left_knee' },
    // Chan Phai (Tim OpenPose)
    right_hip: { id: 'right_hip', name: 'Háng Phải (R Hip)', x: Math.min(width - 1, centerX + hipSpan), y: hipsY + 1, color: '#8b5cf6', parent: 'hips' },
    right_knee: { id: 'right_knee', name: 'Gối Phải (R Knee)', x: Math.min(width - 1, centerX + kneeSpan), y: kneeY, color: '#a855f7', parent: 'right_hip' },
    right_foot: { id: 'right_foot', name: 'Bàn Chân Phải (R Foot)', x: Math.min(width - 1, centerX + kneeSpan), y: footY, color: '#c084fc', parent: 'right_knee' },
    // Vu Khi
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
  const centerY = Math.floor((minY + maxY) / 2);

  // Lay khung xuong: su dung rig duoc truyen vao tu nguoi dung hoac tu dong tinh toan
  const rig = skeletonRig && rigHasValidJoints(skeletonRig)
    ? skeletonRig
    : autoEstimateSkeletonRig(basePixels, width, height);

  const neckY = rig.joints.neck?.y ?? (minY + Math.floor(charH * 0.25));
  const chestY = rig.joints.chest?.y ?? (minY + Math.floor(charH * 0.38));
  const hipsY = rig.joints.hips?.y ?? (minY + Math.floor(charH * 0.58));
  const hipsX = rig.joints.hips?.x ?? centerX;

  const leftShoulder = rig.joints.left_shoulder || { x: centerX - Math.max(3, Math.floor(charW * 0.25)), y: neckY };
  const rightShoulder = rig.joints.right_shoulder || { x: centerX + Math.max(3, Math.floor(charW * 0.25)), y: neckY };
  const leftElbow = rig.joints.left_elbow || { x: leftShoulder.x - 3, y: chestY };
  const rightElbow = rig.joints.right_elbow || { x: rightShoulder.x + 3, y: chestY };
  const leftWrist = rig.joints.left_wrist || { x: leftElbow.x - 2, y: hipsY };
  const rightWrist = rig.joints.right_wrist || { x: rightElbow.x + 2, y: hipsY };
  const weaponJoint = rig.joints.weapon || { x: rightWrist.x + 4, y: rightWrist.y };

  const leftHip = rig.joints.left_hip || { x: hipsX - Math.max(2, Math.floor(charW * 0.16)), y: hipsY + 1 };
  const rightHip = rig.joints.right_hip || { x: hipsX + Math.max(2, Math.floor(charW * 0.16)), y: hipsY + 1 };
  const leftKnee = rig.joints.left_knee || { x: leftHip.x, y: minY + Math.floor(charH * 0.78) };
  const rightKnee = rig.joints.right_knee || { x: rightHip.x, y: minY + Math.floor(charH * 0.78) };
  const leftFoot = rig.joints.left_foot || { x: leftKnee.x, y: maxY };
  const rightFoot = rig.joints.right_foot || { x: rightKnee.x, y: maxY };

  const wristY = Math.max(leftWrist.y, rightWrist.y);

  // Helper tinh khoang cach tu diem toi doan thang
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  // Helper phan loai pixel thuoc ve bo phan giai phau nao dua tren khung xuong da gan
  type BodyPart =
    | 'HEAD'
    | 'CHEST'
    | 'WAIST'
    | 'LEFT_ARM'
    | 'RIGHT_ARM'
    | 'WEAPON'
    | 'LEFT_LEG_UPPER'
    | 'LEFT_LEG_LOWER'
    | 'RIGHT_LEG_UPPER'
    | 'RIGHT_LEG_LOWER';

  const classifyPixel = (p: PixelPoint): BodyPart => {
    // 1. Kiem tra vu khi
    if (weaponJoint && Math.hypot(p.x - weaponJoint.x, p.y - weaponJoint.y) <= 4.5) {
      return 'WEAPON';
    }

    // 2. Kiem tra vung Dau va Co
    if (p.y <= neckY + 1 && Math.abs(p.x - centerX) <= charW * 0.4) {
      return 'HEAD';
    }

    // 3. Vung than tren va hai tay (tu co den hong)
    if (p.y <= hipsY) {
      const dLeftArm = Math.min(
        distToSegment(p.x, p.y, leftShoulder.x, leftShoulder.y, leftElbow.x, leftElbow.y),
        distToSegment(p.x, p.y, leftElbow.x, leftElbow.y, leftWrist.x, leftWrist.y)
      );
      const dRightArm = Math.min(
        distToSegment(p.x, p.y, rightShoulder.x, rightShoulder.y, rightElbow.x, rightElbow.y),
        distToSegment(p.x, p.y, rightElbow.x, rightElbow.y, rightWrist.x, rightWrist.y)
      );

      // Kiem tra thuoc ve tay trai
      if (p.x < leftShoulder.x + 1 && (dLeftArm <= 5.5 || p.x < centerX - charW * 0.22)) {
        return 'LEFT_ARM';
      }
      // Kiem tra thuoc ve tay phai
      if (p.x > rightShoulder.x - 1 && (dRightArm <= 5.5 || p.x > centerX + charW * 0.22)) {
        return 'RIGHT_ARM';
      }

      // Con lai la nguc va eo
      if (p.y <= chestY) {
        return 'CHEST';
      }
      return 'WAIST';
    }

    // 4. Vung hai chan (duoi khop hong)
    if (p.x <= hipsX) {
      // Chan trai
      if (p.y <= leftKnee.y) {
        return 'LEFT_LEG_UPPER';
      }
      return 'LEFT_LEG_LOWER';
    } else {
      // Chan phai
      if (p.y <= rightKnee.y) {
        return 'RIGHT_LEG_UPPER';
      }
      return 'RIGHT_LEG_LOWER';
    }
  };

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
      // Chu ky buoc di OpenPose sinh hoc
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const swingMag = 2.4;
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
            ty = p.y + bodyOffsetY;
            break;
          case 'WAIST': {
            const blendFactor = (p.y - chestY) / Math.max(1, hipsY - chestY);
            ty = p.y + Math.round(bodyOffsetY * (1 - blendFactor));
            break;
          }
          case 'LEFT_ARM': {
            const armSwing = -Math.sin(t) * (swingMag * 0.95);
            const armProg = Math.min(1, Math.max(0, (p.y - neckY) / Math.max(1, wristY - neckY)));
            tx = Math.round(p.x + armProg * armSwing);
            const isFwd = -Math.sin(t) > 0;
            const armLift = isFwd ? Math.abs(Math.sin(t)) * 1.2 : 0;
            ty = Math.round(p.y + bodyOffsetY - armProg * armProg * armLift);
            break;
          }
          case 'RIGHT_ARM':
          case 'WEAPON': {
            const armSwing = Math.sin(t) * (swingMag * 0.95);
            const armProg = Math.min(1, Math.max(0, (p.y - neckY) / Math.max(1, wristY - neckY)));
            tx = Math.round(p.x + armProg * armSwing);
            const isFwd = Math.sin(t) > 0;
            const armLift = isFwd ? Math.abs(Math.sin(t)) * 1.2 : 0;
            ty = Math.round(p.y + bodyOffsetY - armProg * armProg * armLift);
            break;
          }
          case 'LEFT_LEG_UPPER':
          case 'LEFT_LEG_LOWER': {
            const legProg = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
            const legSwing = Math.sin(t) * swingMag;
            tx = Math.round(p.x + legProg * legSwing);
            const isFwd = Math.sin(t) > 0;
            const liftDy = isFwd ? -Math.round(legProg * legProg * (Math.abs(Math.sin(t)) * 1.5)) : 0;
            ty = p.y + liftDy;
            break;
          }
          case 'RIGHT_LEG_UPPER':
          case 'RIGHT_LEG_LOWER': {
            const legProg = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
            const legSwing = -Math.sin(t) * swingMag;
            tx = Math.round(p.x + legProg * legSwing);
            const isFwd = -Math.sin(t) > 0;
            const liftDy = isFwd ? -Math.round(legProg * legProg * (Math.abs(Math.sin(t)) * 1.5)) : 0;
            ty = p.y + liftDy;
            break;
          }
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

    } else if (cleanAction === 'jump') {
      // Dong tac Nhay 4 frames chuan dong hoc nhan vat dua tren khop chan va tay:
      // Frame 0: Nhun lay da (Crouch) - Nguc va hong ha thap, hai dau goi khuyu trung xuong, ban chan bam dat
      // Frame 1: Bat nhay len khong (Airborne) - Toan than bay len cao, 2 chan co gap goi len cao, 2 tay vung qua dau
      // Frame 2: Dinh nhay (Apex) - O tren khong, chan bat dau duoi chuan bi tiep dat
      // Frame 3: Tiep dat (Impact/Landing) - Cham dat, khuyu chan giam chan, hai tay dang ngang giu thang bang
      let dChestY = 0;
      let dWaistY = 0;
      let dLegUpperY = 0;
      let dLegLowerY = 0;
      let dArmY = 0;
      let dArmDx = 0;

      if (frameIdx === 0) {
        // Nhún lấy đà
        dChestY = 2;
        dWaistY = 3;
        dLegUpperY = 3;
        dLegLowerY = 0; // Chân vẫn bám mặt đất
        dArmY = 1;
        dArmDx = 2; // Tay co lùi sau
      } else if (frameIdx === 1) {
        // Bật lên không trung (Airborne)
        dChestY = -7;
        dWaistY = -6;
        dLegUpperY = -7;
        dLegLowerY = -9; // Co rút đầu gối và bàn chân lên cao tạo dáng co chân trên không
        dArmY = -10; // Tay vung cao qua đầu
        dArmDx = -1;
      } else if (frameIdx === 2) {
        // Đạt đỉnh (Apex)
        dChestY = -4;
        dWaistY = -3;
        dLegUpperY = -4;
        dLegLowerY = -4;
        dArmY = -5;
        dArmDx = 0;
      } else {
        // Tiếp đất khuỵu chân
        dChestY = 2;
        dWaistY = 3;
        dLegUpperY = 3;
        dLegLowerY = 0;
        dArmY = 0;
        dArmDx = -2;
      }

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
            ty = p.y + dChestY;
            break;
          case 'WAIST':
            ty = p.y + dWaistY;
            break;
          case 'LEFT_ARM':
            tx = p.x - dArmDx;
            ty = p.y + dArmY;
            break;
          case 'RIGHT_ARM':
          case 'WEAPON':
            tx = p.x + dArmDx;
            ty = p.y + dArmY;
            break;
          case 'LEFT_LEG_UPPER':
            tx = p.x - (frameIdx === 0 || frameIdx === 3 ? 1 : 0);
            ty = p.y + dLegUpperY;
            break;
          case 'RIGHT_LEG_UPPER':
            tx = p.x + (frameIdx === 0 || frameIdx === 3 ? 1 : 0);
            ty = p.y + dLegUpperY;
            break;
          case 'LEFT_LEG_LOWER':
          case 'RIGHT_LEG_LOWER':
            ty = p.y + dLegLowerY;
            break;
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

    } else if (cleanAction === 'attack' || cleanAction === 'slash') {
      // 4 frames chem kiem hoat hoa theo dung khop tay phai & vu khi:
      // Frame 0: Gio kiem cao ra sau dau lay da
      // Frame 1: Lao toi truoc, vung chem manh cheo tu tren xuong, vu khi phat vet chem quang
      // Frame 2: Quan tinh ha kiem ve phia truoc
      // Frame 3: Thu kiem ve the thu
      let bodyDx = 0;
      let bodyDy = 0;
      let swordArmDx = 0;
      let swordArmDy = 0;
      let offArmDx = 0;
      let offArmDy = 0;

      if (frameIdx === 0) {
        bodyDx = -1;
        bodyDy = 0;
        swordArmDx = -4; // Giơ kiếm ra sau đầu
        swordArmDy = -4;
        offArmDx = 2;
        offArmDy = 1;
      } else if (frameIdx === 1) {
        bodyDx = 3; // Lao mạnh tới trước
        bodyDy = 1;
        swordArmDx = 6; // Chém mạnh về phía trước
        swordArmDy = 3;
        offArmDx = -3;
        offArmDy = 2;
      } else if (frameIdx === 2) {
        bodyDx = 2;
        bodyDy = 1;
        swordArmDx = 4;
        swordArmDy = 4; // Hạ kiếm theo quán tính
        offArmDx = -1;
        offArmDy = 0;
      } else {
        bodyDx = 0;
        bodyDy = 0;
        swordArmDx = 0;
        swordArmDy = 0;
        offArmDx = 0;
        offArmDy = 0;
      }

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
          case 'WAIST':
            tx = p.x + bodyDx;
            ty = p.y + bodyDy;
            break;
          case 'RIGHT_ARM':
          case 'WEAPON':
            // Cánh tay cầm vũ khí vung chém
            tx = p.x + swordArmDx;
            ty = p.y + swordArmDy;
            break;
          case 'LEFT_ARM':
            tx = p.x + offArmDx;
            ty = p.y + offArmDy;
            break;
          case 'LEFT_LEG_UPPER':
          case 'LEFT_LEG_LOWER':
            tx = p.x + (frameIdx === 1 ? -1 : 0);
            ty = p.y;
            break;
          case 'RIGHT_LEG_UPPER':
          case 'RIGHT_LEG_LOWER':
            tx = p.x + (frameIdx === 1 ? 2 : (frameIdx === 0 ? -1 : 0));
            ty = p.y;
            break;
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

      // Ve vet chem quang (Slash Arc VFX) xuat phat chinh xac tu khop vu khi hoac co tay phai
      if (frameIdx === 1) {
        const arcCenterX = weaponJoint.x + swordArmDx - 2;
        const arcCenterY = weaponJoint.y + swordArmDy - 2;
        const radius = Math.max(10, Math.floor(charW * 0.65));

        for (let angleDeg = -85; angleDeg <= 65; angleDeg += 4) {
          const rad = (angleDeg * Math.PI) / 180;
          const arcX = Math.round(arcCenterX + Math.cos(rad) * radius);
          const arcY = Math.round(arcCenterY + Math.sin(rad) * radius);

          setPixel(arcX, arcY, '#ffffff');
          setPixel(arcX - 1, arcY, '#67e8f9');
          setPixel(arcX, arcY - 1, '#38bdf8');
          setPixel(arcX + 1, arcY, '#a5f3fc');
        }
      }

    } else if (cleanAction === 'sit') {
      // 2 frames ngoi nghi: Ha thap hong va than tren, chan gap ngang
      const isShift = frameIdx === 1;
      const sitDownY = 6;
      const waistDownY = 8;

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
            ty = p.y + sitDownY + (isShift ? 1 : 0);
            break;
          case 'WAIST':
            ty = p.y + waistDownY + (isShift ? 1 : 0);
            break;
          case 'LEFT_ARM':
          case 'RIGHT_ARM':
          case 'WEAPON':
            ty = p.y + sitDownY + 2 + (isShift ? 1 : 0);
            break;
          case 'LEFT_LEG_UPPER':
            tx = p.x - 2;
            ty = p.y + waistDownY;
            break;
          case 'RIGHT_LEG_UPPER':
            tx = p.x + 2;
            ty = p.y + waistDownY;
            break;
          case 'LEFT_LEG_LOWER':
          case 'RIGHT_LEG_LOWER':
            ty = p.y + 4;
            break;
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

    } else if (cleanAction === 'defeated') {
      // Bị hạ gục / Nằm: Frame 0 khuỵu ngã, Frame 1 nằm sấp phẳng
      const isFlat = frameIdx >= 1;

      for (const p of basePixels) {
        if (!p.color) continue;
        let tx = p.x;
        let ty = p.y;

        if (!isFlat) {
          // Khuỵu ngã nghiêng
          tx = p.x - Math.round((p.y - minY) * 0.15);
          ty = p.y + 4;
        } else {
          // Nằm gục xuống sàn
          const groundY = Math.min(height - 4, maxY);
          ty = groundY - Math.round((maxY - p.y) * 0.25);
          tx = centerX + Math.round((p.y - centerY) * 0.8) + Math.round((p.x - centerX) * 0.5);
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

    } else if (cleanAction === 'run') {
      // Chạy nhanh: Sải bước mạnh hơn và thân người hơi chúi tới trước
      const t = (frameIdx / frameCount) * 2 * Math.PI;
      const swingMag = 3.6;
      const isBobbing = frameIdx % 2 === 1;
      const bodyOffsetY = isBobbing ? -1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
            tx = p.x + 1;
            ty = p.y + bodyOffsetY;
            break;
          case 'WAIST': {
            const blendFactor = (p.y - chestY) / Math.max(1, hipsY - chestY);
            tx = p.x + 1;
            ty = p.y + Math.round(bodyOffsetY * (1 - blendFactor));
            break;
          }
          case 'LEFT_ARM': {
            const armSwing = -Math.sin(t) * (swingMag * 1.1);
            const armProg = Math.min(1, Math.max(0, (p.y - neckY) / Math.max(1, wristY - neckY)));
            tx = Math.round(p.x + 1 + armProg * armSwing);
            const isFwd = -Math.sin(t) > 0;
            const armLift = isFwd ? Math.abs(Math.sin(t)) * 1.8 : 0;
            ty = Math.round(p.y + bodyOffsetY - armProg * armProg * armLift);
            break;
          }
          case 'RIGHT_ARM':
          case 'WEAPON': {
            const armSwing = Math.sin(t) * (swingMag * 1.1);
            const armProg = Math.min(1, Math.max(0, (p.y - neckY) / Math.max(1, wristY - neckY)));
            tx = Math.round(p.x + 1 + armProg * armSwing);
            const isFwd = Math.sin(t) > 0;
            const armLift = isFwd ? Math.abs(Math.sin(t)) * 1.8 : 0;
            ty = Math.round(p.y + bodyOffsetY - armProg * armProg * armLift);
            break;
          }
          case 'LEFT_LEG_UPPER':
          case 'LEFT_LEG_LOWER': {
            const legProg = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
            const legSwing = Math.sin(t) * swingMag;
            tx = Math.round(p.x + legProg * legSwing);
            const isFwd = Math.sin(t) > 0;
            const liftDy = isFwd ? -Math.round(legProg * legProg * (Math.abs(Math.sin(t)) * 1.9)) : 0;
            ty = p.y + liftDy;
            break;
          }
          case 'RIGHT_LEG_UPPER':
          case 'RIGHT_LEG_LOWER': {
            const legProg = Math.min(1, Math.max(0, (p.y - hipsY) / Math.max(1, maxY - hipsY)));
            const legSwing = -Math.sin(t) * swingMag;
            tx = Math.round(p.x + legProg * legSwing);
            const isFwd = -Math.sin(t) > 0;
            const liftDy = isFwd ? -Math.round(legProg * legProg * (Math.abs(Math.sin(t)) * 1.9)) : 0;
            ty = p.y + liftDy;
            break;
          }
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
      }

    } else {
      // Idle / Mac dinh: Tho nhe nhang
      const isBreathing = frameIdx % 2 === 1;
      const bodyOffsetY = isBreathing ? 1 : 0;

      for (const p of basePixels) {
        if (!p.color) continue;
        const part = classifyPixel(p);
        let tx = p.x;
        let ty = p.y;

        switch (part) {
          case 'HEAD':
          case 'CHEST':
            ty = p.y + bodyOffsetY;
            break;
          case 'WAIST':
            ty = p.y + Math.round(bodyOffsetY * 0.5);
            break;
          case 'LEFT_ARM':
          case 'RIGHT_ARM':
          case 'WEAPON':
            ty = p.y + bodyOffsetY;
            break;
          case 'LEFT_LEG_UPPER':
          case 'LEFT_LEG_LOWER':
          case 'RIGHT_LEG_UPPER':
          case 'RIGHT_LEG_LOWER':
            ty = p.y;
            break;
        }

        mappedPoints.push({ origX: p.x, origY: p.y, targetX: tx, targetY: ty, color: p.color });
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

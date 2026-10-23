// Bo chuyen doi dong bo du lieu LPC sang he thong Studio (LayerData, FrameData, AnimationClip)
// Chuyen doi tu ImageData/Canvas sang cau truc pixel cua Pixel Draw va xuat atlas game

import {
  LayerData,
  FrameData,
  AnimationClip,
  PixelColor,
  coordToKey
} from '@pixel-draw/shared-types';
import { LpcCompositor } from './lpc-compositor';
import { LpcDirection, LPC_GRID_CONFIG } from './lpc-matrix';

// Chuyen doi mot Canvas 64x64 thanh LayerData tuong thich Studio
export function convertCanvasToLayerData(
  canvas: HTMLCanvasElement,
  layerId: string,
  layerName: string
): LayerData {
  const ctx = canvas.getContext('2d');
  const pixels: Record<string, PixelColor> = {};

  if (ctx) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Bo qua cac pixel hoan toan trong suot
        if (a === 0) continue;

        // Chuyen sang ma mau hex
        let hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        if (a < 255) {
          const alphaHex = Math.round(a).toString(16).padStart(2, '0');
          hex = `${hex}${alphaHex}`;
        }
        pixels[coordToKey(x, y)] = hex;
      }
    }
  }

  return {
    id: layerId,
    name: layerName,
    visible: true,
    locked: false,
    opacity: 1.0,
    pixels
  };
}

// Chuyen doi toan bo hoat canh LPC (mot hanh dong va mot huong) thanh AnimationClip cho Timeline
export function createAnimationClipFromLpc(
  compositor: LpcCompositor,
  actionId: string,
  direction: LpcDirection,
  customClipName?: string
): AnimationClip {
  const group = compositor.getActionGroup(actionId);
  if (!group) {
    throw new Error(`Khong tim thay nhom hanh dong LPC co ma: ${actionId}`);
  }

  const dirInfo = group.directions[direction];
  if (!dirInfo) {
    throw new Error(`Huong nhin ${direction} khong hop le cho hanh dong ${actionId}`);
  }

  const frameCount = dirInfo.frameCount;
  const rowIndex = dirInfo.rowIndex;
  const fps = compositor.getFps() || group.defaultFps;
  const durationMs = Math.max(16, Math.floor(1000 / fps));
  const frames: FrameData[] = [];

  for (let col = 0; col < frameCount; col++) {
    // 1. Cat va ghep frame o cot col va hang rowIndex
    const frameCanvas = compositor.compositeFrameAt(col, rowIndex);

    // 2. Chuyen thanh LayerData
    const layerId = `layer_lpc_${actionId}_${direction}_f${col}_${Date.now()}`;
    const layer = convertCanvasToLayerData(frameCanvas, layerId, `LPC ${group.name}`);

    // 3. Dong goi vao FrameData
    frames.push({
      id: `frame_lpc_${actionId}_${col}_${Date.now()}`,
      durationMs,
      layers: [layer]
    });
  }

  const clipId = `clip_lpc_${actionId}_${direction}_${Date.now()}`;
  const clipName = customClipName || `${actionId}_${direction}`;
  const dirLabels: Record<LpcDirection, string> = {
    up: 'Lên',
    left: 'Trái',
    down: 'Xuống',
    right: 'Phải'
  };

  return {
    id: clipId,
    name: clipName,
    label: `${group.name} (${dirLabels[direction]})`,
    startFrame: 0,
    endFrame: Math.max(0, frames.length - 1),
    fps,
    loop: group.loop,
    frames
  };
}

// Xuat dải hoạt cảnh hiện tại thành Spritesheet Strip (PNG + Metadata JSON)
export function exportLpcActionStrip(
  compositor: LpcCompositor,
  actionId: string,
  direction: LpcDirection
): { canvas: HTMLCanvasElement; metadata: any } {
  const group = compositor.getActionGroup(actionId);
  if (!group) {
    throw new Error(`Hành động ${actionId} không hợp lệ.`);
  }

  const dirInfo = group.directions[direction];
  const frameCount = dirInfo.frameCount;
  const rowIndex = dirInfo.rowIndex;

  const fw = LPC_GRID_CONFIG.frameWidth;
  const fh = LPC_GRID_CONFIG.frameHeight;

  // Tao canvas chua toan bo chuoi frame nam ngang
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = fw * frameCount;
  stripCanvas.height = fh;
  const stripCtx = stripCanvas.getContext('2d');
  if (stripCtx) {
    stripCtx.imageSmoothingEnabled = false;
  }

  const framesMeta = [];

  for (let col = 0; col < frameCount; col++) {
    const singleCanvas = compositor.compositeFrameAt(col, rowIndex);
    if (stripCtx) {
      stripCtx.drawImage(singleCanvas, col * fw, 0);
    }
    framesMeta.push({
      frame: { x: col * fw, y: 0, w: fw, h: fh },
      duration: Math.floor(1000 / group.defaultFps)
    });
  }

  const metadata = {
    action: actionId,
    actionName: group.name,
    direction,
    frameCount,
    fps: group.defaultFps,
    loop: group.loop,
    pivot: { x: LPC_GRID_CONFIG.pivotX, y: LPC_GRID_CONFIG.pivotY },
    frames: framesMeta
  };

  return { canvas: stripCanvas, metadata };
}

// Thu thập toàn bộ N khung hình composite của một hành động theo một hướng nhìn.
// Mỗi phần tử trong mảng là Canvas độc lập 64x64 đã được ghép đủ các layer.
export function getAllActionFrames(
  compositor: LpcCompositor,
  actionId: string,
  direction: LpcDirection
): HTMLCanvasElement[] {
  const group = compositor.getActionGroup(actionId);
  if (!group) {
    throw new Error(`Hành động "${actionId}" không tồn tại trong bảng LPC.`);
  }

  const dirInfo = group.directions[direction];
  if (!dirInfo) {
    throw new Error(`Hướng nhìn "${direction}" không hợp lệ cho hành động "${actionId}".`);
  }

  const { frameCount, rowIndex } = dirInfo;
  const frames: HTMLCanvasElement[] = [];

  for (let col = 0; col < frameCount; col++) {
    // Ghép tất cả layer tại frame (col, rowIndex) và trả về canvas độc lập
    frames.push(compositor.compositeFrameAt(col, rowIndex));
  }

  return frames;
}



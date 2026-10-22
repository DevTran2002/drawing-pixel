// Ma tran dinh nghia he thong LPC 54 hang x 13 cot (Universal LPC Spritesheet Standard)
// Cung cap cac hang so, kieu du lieu va ham tien ich cat frame 64x64 pixel

export type LpcDirection = 'up' | 'left' | 'down' | 'right';

export interface LpcFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LpcActionRow {
  actionId: string;
  actionName: string;
  direction: LpcDirection;
  rowIndex: number;
  frameCount: number;
  fps: number;
  loop: boolean;
}

export interface LpcActionGroup {
  id: string;
  name: string;
  description: string;
  directions: Record<LpcDirection, {
    rowIndex: number;
    frameCount: number;
  }>;
  defaultFps: number;
  loop: boolean;
}

// Thong so luoi khung hinh tieu chuan Universal LPC
export const LPC_GRID_CONFIG = {
  sheetWidth: 832,
  sheetHeight: 3456,
  frameWidth: 64,
  frameHeight: 64,
  maxCols: 13,
  totalRows: 54,
  pivotX: 32,
  pivotY: 63
} as const;

// Danh muc cac nhom hoat canh chinh trong LPC 54 hang
export const LPC_ACTION_GROUPS: LpcActionGroup[] = [
  {
    id: 'walk',
    name: 'Bước đi (Walk)',
    description: 'Chu kỳ bước đi 4 hướng (Frame 0: Đứng im, Frame 1-8: Sải bước)',
    directions: {
      up: { rowIndex: 8, frameCount: 9 },
      left: { rowIndex: 9, frameCount: 9 },
      down: { rowIndex: 10, frameCount: 9 },
      right: { rowIndex: 11, frameCount: 9 }
    },
    defaultFps: 10,
    loop: true
  },
  {
    id: 'slash',
    name: 'Chém kiếm (Slash)',
    description: 'Vung vũ khí chém mạnh theo 4 hướng',
    directions: {
      up: { rowIndex: 12, frameCount: 6 },
      left: { rowIndex: 13, frameCount: 6 },
      down: { rowIndex: 14, frameCount: 6 },
      right: { rowIndex: 15, frameCount: 6 }
    },
    defaultFps: 12,
    loop: false
  },
  {
    id: 'spellcast',
    name: 'Niệm phép (Spellcast)',
    description: 'Giơ tay tập trung năng lượng và giải phóng phép thuật',
    directions: {
      up: { rowIndex: 0, frameCount: 7 },
      left: { rowIndex: 1, frameCount: 7 },
      down: { rowIndex: 2, frameCount: 7 },
      right: { rowIndex: 3, frameCount: 7 }
    },
    defaultFps: 8,
    loop: false
  },
  {
    id: 'thrust',
    name: 'Đâm giáo (Thrust)',
    description: 'Đâm vũ khí tầm xa thẳng về phía trước',
    directions: {
      up: { rowIndex: 4, frameCount: 8 },
      left: { rowIndex: 5, frameCount: 8 },
      down: { rowIndex: 6, frameCount: 8 },
      right: { rowIndex: 7, frameCount: 8 }
    },
    defaultFps: 10,
    loop: false
  },
  {
    id: 'shoot',
    name: 'Bắn cung (Shoot)',
    description: 'Rút cung tên, ngắm bắn và bắn tên',
    directions: {
      up: { rowIndex: 16, frameCount: 13 },
      left: { rowIndex: 17, frameCount: 13 },
      down: { rowIndex: 18, frameCount: 13 },
      right: { rowIndex: 19, frameCount: 13 }
    },
    defaultFps: 12,
    loop: false
  },
  {
    id: 'hurt',
    name: 'Chịu đòn (Hurt / Fall)',
    description: 'Bị sát thương văng ra sau và ngã quỵ xuống đất',
    directions: {
      up: { rowIndex: 20, frameCount: 6 },
      left: { rowIndex: 20, frameCount: 6 },
      down: { rowIndex: 20, frameCount: 6 },
      right: { rowIndex: 20, frameCount: 6 }
    },
    defaultFps: 8,
    loop: false
  },
  {
    id: 'climb',
    name: 'Leo trèo (Climb)',
    description: 'Động tác trèo thang hoặc leo tường',
    directions: {
      up: { rowIndex: 21, frameCount: 6 },
      left: { rowIndex: 22, frameCount: 6 },
      down: { rowIndex: 23, frameCount: 6 },
      right: { rowIndex: 24, frameCount: 6 }
    },
    defaultFps: 8,
    loop: true
  },
  {
    id: 'sit',
    name: 'Ngồi nghỉ (Sit)',
    description: 'Tư thế ngồi nghỉ ngơi hoặc ngồi ghế theo 4 hướng',
    directions: {
      up: { rowIndex: 25, frameCount: 3 },
      left: { rowIndex: 26, frameCount: 3 },
      down: { rowIndex: 27, frameCount: 3 },
      right: { rowIndex: 28, frameCount: 3 }
    },
    defaultFps: 4,
    loop: true
  },
  {
    id: 'run',
    name: 'Chạy nhanh (Run)',
    description: 'Chạy nước rút sải chân dài',
    directions: {
      up: { rowIndex: 33, frameCount: 8 },
      left: { rowIndex: 34, frameCount: 8 },
      down: { rowIndex: 35, frameCount: 8 },
      right: { rowIndex: 36, frameCount: 8 }
    },
    defaultFps: 14,
    loop: true
  },
  {
    id: 'combat_idle',
    name: 'Thủ thế chiến đấu (Combat Idle)',
    description: 'Tư thế nhún nhẹ thủ thế chuẩn bị giao tranh',
    directions: {
      up: { rowIndex: 37, frameCount: 4 },
      left: { rowIndex: 38, frameCount: 4 },
      down: { rowIndex: 39, frameCount: 4 },
      right: { rowIndex: 40, frameCount: 4 }
    },
    defaultFps: 6,
    loop: true
  }
];

// Helper tinh toan hinh chu nhat toa do cua mot frame cu the tren spritesheet
export function getLpcFrameRect(col: number, row: number): LpcFrameRect {
  const fw = LPC_GRID_CONFIG.frameWidth;
  const fh = LPC_GRID_CONFIG.frameHeight;
  return {
    x: Math.max(0, col * fw),
    y: Math.max(0, row * fh),
    width: fw,
    height: fh
  };
}

// Helper cat 1 frame 64x64 tu anh nguon vao Canvas doc lap
export function extractLpcFrameToCanvas(
  source: CanvasImageSource,
  col: number,
  row: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = LPC_GRID_CONFIG.frameWidth;
  canvas.height = LPC_GRID_CONFIG.frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  const rect = getLpcFrameRect(col, row);
  ctx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return canvas;
}

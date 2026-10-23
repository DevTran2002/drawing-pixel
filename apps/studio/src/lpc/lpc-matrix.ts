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

// Danh muc cac nhom hoat canh chinh trong LPC 54 hang theo chuan Universal LPC
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
    description: 'Bị sát thương văng ra sau và ngã quỵ xuống đất (chuẩn LPC chỉ có 1 hàng đơn)',
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
    description: 'Động tác leo trèo thang nhìn từ sau lưng (chuẩn LPC chỉ có 1 hàng đơn Row 21)',
    directions: {
      up: { rowIndex: 21, frameCount: 6 },
      left: { rowIndex: 21, frameCount: 6 },
      down: { rowIndex: 21, frameCount: 6 },
      right: { rowIndex: 21, frameCount: 6 }
    },
    defaultFps: 8,
    loop: true
  },
  {
    id: 'idle',
    name: 'Đứng thở (Idle)',
    description: 'Đứng yên thở nhẹ nhàng theo 4 hướng',
    directions: {
      up: { rowIndex: 22, frameCount: 2 },
      left: { rowIndex: 23, frameCount: 2 },
      down: { rowIndex: 24, frameCount: 2 },
      right: { rowIndex: 25, frameCount: 2 }
    },
    defaultFps: 4,
    loop: true
  },
  {
    id: 'jump',
    name: 'Bật nhảy (Jump)',
    description: 'Động tác bật nhảy cao lên không trung theo 4 hướng',
    directions: {
      up: { rowIndex: 26, frameCount: 5 },
      left: { rowIndex: 27, frameCount: 5 },
      down: { rowIndex: 28, frameCount: 5 },
      right: { rowIndex: 29, frameCount: 5 }
    },
    defaultFps: 8,
    loop: false
  },
  {
    id: 'sit',
    name: 'Ngồi nghỉ (Sit)',
    description: 'Tư thế ngồi nghỉ ngơi hoặc ngồi ghế theo 4 hướng',
    directions: {
      up: { rowIndex: 30, frameCount: 3 },
      left: { rowIndex: 31, frameCount: 3 },
      down: { rowIndex: 32, frameCount: 3 },
      right: { rowIndex: 33, frameCount: 3 }
    },
    defaultFps: 4,
    loop: true
  },
  {
    id: 'emote',
    name: 'Biểu cảm (Emote)',
    description: 'Hành động biểu cảm giơ tay chào hoặc hoan hô theo 4 hướng',
    directions: {
      up: { rowIndex: 34, frameCount: 3 },
      left: { rowIndex: 35, frameCount: 3 },
      down: { rowIndex: 36, frameCount: 3 },
      right: { rowIndex: 37, frameCount: 3 }
    },
    defaultFps: 6,
    loop: true
  },
  {
    id: 'run',
    name: 'Chạy nhanh (Run)',
    description: 'Chạy nước rút sải chân dài theo 4 hướng',
    directions: {
      up: { rowIndex: 38, frameCount: 8 },
      left: { rowIndex: 39, frameCount: 8 },
      down: { rowIndex: 40, frameCount: 8 },
      right: { rowIndex: 41, frameCount: 8 }
    },
    defaultFps: 12,
    loop: true
  },
  {
    id: 'combat_idle',
    name: 'Thủ thế chiến đấu (Combat Idle)',
    description: 'Tư thế nhún người thủ thế chuẩn bị giao tranh theo 4 hướng',
    directions: {
      up: { rowIndex: 42, frameCount: 2 },
      left: { rowIndex: 43, frameCount: 2 },
      down: { rowIndex: 44, frameCount: 2 },
      right: { rowIndex: 45, frameCount: 2 }
    },
    defaultFps: 4,
    loop: true
  },
  {
    id: 'backslash',
    name: 'Chém ngược (Backslash)',
    description: 'Vung kiếm chém ngược cực mạnh (13 frames)',
    directions: {
      up: { rowIndex: 46, frameCount: 13 },
      left: { rowIndex: 47, frameCount: 13 },
      down: { rowIndex: 48, frameCount: 13 },
      right: { rowIndex: 49, frameCount: 13 }
    },
    defaultFps: 12,
    loop: false
  },
  {
    id: 'halfslash',
    name: 'Chém nửa vòng (Halfslash)',
    description: 'Chém kiếm nhanh nửa vòng tròn (6 frames)',
    directions: {
      up: { rowIndex: 50, frameCount: 6 },
      left: { rowIndex: 51, frameCount: 6 },
      down: { rowIndex: 52, frameCount: 6 },
      right: { rowIndex: 53, frameCount: 6 }
    },
    defaultFps: 10,
    loop: false
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

// Bảng ma trận độ lệch chuyển động khung xương (Motion Rig Offsets) cho 9 hành động mở rộng
// Đo đạc chuẩn xác từng pixel theo chu kỳ cử động của phôi thân người trong sprites.png
// Giúp toàn bộ phụ kiện cổ điển (tai, đuôi, tóc, mũ, áo, quần, ủng, khiên, kiếm...)
// tự động uốn lượn, nhún người, nhảy lên, hạ thấp trọng tâm ôm khít 100% vào cơ thể.
export const LPC_MOTION_RIG_OFFSETS: Record<string, Partial<Record<LpcDirection, Array<{ dx: number; dy: number }>>>> = {
  // 1. Leo trèo (Climb - 6 frames, góc nhìn từ sau lưng)
  climb: {
    up: [
      { dx: 1, dy: -3 }, { dx: 1, dy: -2 }, { dx: 0, dy: -4 },
      { dx: -1, dy: -3 }, { dx: -1, dy: -2 }, { dx: 0, dy: -4 }
    ],
    left: [
      { dx: 1, dy: -3 }, { dx: 1, dy: -2 }, { dx: 0, dy: -4 },
      { dx: -1, dy: -3 }, { dx: -1, dy: -2 }, { dx: 0, dy: -4 }
    ],
    down: [
      { dx: 1, dy: -3 }, { dx: 1, dy: -2 }, { dx: 0, dy: -4 },
      { dx: -1, dy: -3 }, { dx: -1, dy: -2 }, { dx: 0, dy: -4 }
    ],
    right: [
      { dx: 1, dy: -3 }, { dx: 1, dy: -2 }, { dx: 0, dy: -4 },
      { dx: -1, dy: -3 }, { dx: -1, dy: -2 }, { dx: 0, dy: -4 }
    ]
  },

  // 2. Đứng thở (Idle - 2 frames)
  idle: {
    up: [{ dx: 0, dy: 1 }, { dx: 0, dy: 0 }],
    left: [{ dx: 0, dy: 0 }, { dx: 0, dy: -1 }],
    down: [{ dx: 0, dy: 0 }, { dx: 0, dy: -1 }],
    right: [{ dx: 0, dy: 0 }, { dx: 0, dy: -1 }]
  },

  // 3. Bật nhảy (Jump - 5 frames: nhún lấy đà -> bật lên cao -> rơi xuống -> tiếp đất)
  jump: {
    up: [
      { dx: 0, dy: 2 }, { dx: 0, dy: 4 }, { dx: 0, dy: -2 }, { dx: 0, dy: -4 }, { dx: 0, dy: 0 }
    ],
    left: [
      { dx: 0, dy: 0 }, { dx: -3, dy: 3 }, { dx: 0, dy: -1 }, { dx: 0, dy: -3 }, { dx: 0, dy: 1 }
    ],
    down: [
      { dx: 0, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: 0 }, { dx: 0, dy: -3 }, { dx: 0, dy: 1 }
    ],
    right: [
      { dx: 0, dy: 0 }, { dx: 3, dy: 3 }, { dx: 0, dy: -1 }, { dx: 0, dy: -3 }, { dx: 0, dy: 1 }
    ]
  },

  // 4. Ngồi nghỉ (Sit - 3 frames: ngồi xuống -> ngồi bệt sâu -> đứng dậy)
  sit: {
    up: [
      { dx: 0, dy: 10 }, { dx: -1, dy: 9 }, { dx: 0, dy: 0 }
    ],
    left: [
      { dx: 0, dy: 8 }, { dx: 0, dy: 8 }, { dx: -3, dy: 0 }
    ],
    down: [
      { dx: 0, dy: 2 }, { dx: 0, dy: 7 }, { dx: 0, dy: -2 }
    ],
    right: [
      { dx: 0, dy: 9 }, { dx: 0, dy: 9 }, { dx: 3, dy: 0 }
    ]
  },

  // 5. Biểu cảm (Emote - 3 frames)
  emote: {
    up: [{ dx: 0, dy: 1 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }],
    left: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 6, dy: -2 }],
    down: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: -2 }],
    right: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: -6, dy: -2 }]
  },

  // 6. Chạy nhanh (Run - 8 frames chu kỳ sải chân nghiêng người)
  run: {
    up: [
      { dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 0 }, { dx: 0, dy: -2 },
      { dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 0 }, { dx: 0, dy: -2 }
    ],
    left: [
      { dx: -2, dy: 1 }, { dx: -2, dy: 2 }, { dx: -2, dy: 1 }, { dx: -2, dy: -1 },
      { dx: -2, dy: 1 }, { dx: -2, dy: 2 }, { dx: -2, dy: 1 }, { dx: -2, dy: -1 }
    ],
    down: [
      { dx: 0, dy: 1 }, { dx: 0, dy: 2 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }, { dx: 0, dy: 2 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ],
    right: [
      { dx: 2, dy: 1 }, { dx: 2, dy: 2 }, { dx: 2, dy: 1 }, { dx: 2, dy: -1 },
      { dx: 2, dy: 1 }, { dx: 2, dy: 2 }, { dx: 2, dy: 1 }, { dx: 2, dy: -1 }
    ]
  },

  // 7. Thủ thế chiến đấu (Combat Idle - 2 frames)
  combat_idle: {
    up: [{ dx: 0, dy: 1 }, { dx: 0, dy: 3 }],
    left: [{ dx: -2, dy: 0 }, { dx: -3, dy: 2 }],
    down: [{ dx: 1, dy: -1 }, { dx: 1, dy: 1 }],
    right: [{ dx: 2, dy: 0 }, { dx: 3, dy: 2 }]
  },

  // 8. Chém ngược (Backslash - 13 frames)
  backslash: {
    up: [
      { dx: -1, dy: 4 }, { dx: 0, dy: 0 }, { dx: -4, dy: 1 }, { dx: -6, dy: 2 }, { dx: -6, dy: 2 },
      { dx: -6, dy: 2 }, { dx: 0, dy: 0 }, { dx: -7, dy: 2 }, { dx: -5, dy: 1 }, { dx: 1, dy: 0 },
      { dx: 3, dy: 0 }, { dx: 3, dy: 0 }, { dx: 3, dy: 0 }
    ],
    left: [
      { dx: 5, dy: -1 }, { dx: -7, dy: 1 }, { dx: -9, dy: 2 }, { dx: -10, dy: 2 }, { dx: -10, dy: 2 },
      { dx: -10, dy: 2 }, { dx: -7, dy: 1 }, { dx: -8, dy: 2 }, { dx: -3, dy: 2 }, { dx: 1, dy: 0 },
      { dx: 4, dy: -1 }, { dx: 4, dy: -1 }, { dx: 4, dy: -1 }
    ],
    down: [
      { dx: -3, dy: -1 }, { dx: 1, dy: 1 }, { dx: 3, dy: 1 }, { dx: 4, dy: 1 }, { dx: 4, dy: 1 },
      { dx: 4, dy: 1 }, { dx: 1, dy: 1 }, { dx: 6, dy: 1 }, { dx: 3, dy: 1 }, { dx: 0, dy: -1 },
      { dx: -1, dy: -2 }, { dx: -1, dy: -2 }, { dx: -1, dy: -2 }
    ],
    right: [
      { dx: -5, dy: -1 }, { dx: 7, dy: 1 }, { dx: 9, dy: 2 }, { dx: 10, dy: 2 }, { dx: 10, dy: 2 },
      { dx: 10, dy: 2 }, { dx: 7, dy: 1 }, { dx: 9, dy: 2 }, { dx: 3, dy: 2 }, { dx: -1, dy: 0 },
      { dx: -4, dy: -1 }, { dx: -4, dy: -1 }, { dx: -4, dy: -1 }
    ]
  },

  // 9. Chém nửa vòng (Halfslash - 6 frames)
  halfslash: {
    up: [
      { dx: -1, dy: 4 }, { dx: 0, dy: 0 }, { dx: -3, dy: -1 },
      { dx: -3, dy: -2 }, { dx: -3, dy: -2 }, { dx: 0, dy: 0 }
    ],
    left: [
      { dx: 5, dy: -1 }, { dx: -7, dy: 1 }, { dx: -10, dy: 2 },
      { dx: -14, dy: 2 }, { dx: -14, dy: 2 }, { dx: -7, dy: 1 }
    ],
    down: [
      { dx: -3, dy: -1 }, { dx: 1, dy: 1 }, { dx: 3, dy: 2 },
      { dx: 4, dy: 2 }, { dx: 4, dy: 2 }, { dx: 1, dy: 1 }
    ],
    right: [
      { dx: -5, dy: -1 }, { dx: 7, dy: 1 }, { dx: 10, dy: 2 },
      { dx: 14, dy: 2 }, { dx: 14, dy: 2 }, { dx: 7, dy: 1 }
    ]
  }
};

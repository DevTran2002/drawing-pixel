// apps/studio/src/lpc/lpc-palette.ts
// Module định nghĩa các bảng màu dải bậc (Palette Color Ramps) chuẩn LPC
// và thuật toán ánh xạ màu giữ nguyên bóng khối (Palette Recolor & Shading)

export type LpcPaletteCategory = 'hair' | 'torso' | 'legs' | 'feet' | 'hat' | 'body';

export interface PaletteRamp {
  id: string;
  name: string;
  category: LpcPaletteCategory | 'general';
  colors: string[]; // Danh sách các mã màu hex từ vùng tối nhất đến vùng sáng nhất
}

// Bảng dải màu nguồn mặc định của từng loại phụ kiện khi xuất xưởng
export const DEFAULT_SOURCE_RAMPS = {
  // Dải màu tóc đỏ hung chuẩn LPC gốc
  hair: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00'],
  // Dải màu giáp sắt chuẩn LPC gốc
  torso: ['#1d131e', '#4d4a5d', '#726b7e', '#867e7f', '#c4b59f', '#ffffff'],
  // Dải màu quần vải chuẩn LPC gốc
  legs: ['#281820', '#4d4a5d', '#958080', '#c4b59f', '#e5e6c7'],
  // Dải màu ủng da chuẩn LPC gốc
  feet: ['#211812', '#362419', '#543926', '#7a5538', '#a87850'],
  // Dải màu mũ sắt chuẩn LPC gốc
  hat: ['#1d131e', '#4d4a5d', '#726b7e', '#867e7f', '#c4b59f', '#ffffff'],
  // Dải màu da sáng cơ bản
  body: ['#8f563b', '#c28569', '#e0a98b', '#f2cbb3', '#ffe4d4']
};

// Danh mục các bảng màu tùy chọn cho từng bộ phận
export const LPC_PALETTES: Record<LpcPaletteCategory, PaletteRamp[]> = {



  hair: [
    {
      id: 'hair_brown',
      name: 'Nâu Tự Nhiên',
      category: 'hair',
      colors: ['#2b180d', '#4d2a14', '#78431e', '#a56230', '#cf874e']
    },
    {
      id: 'hair_blonde',
      name: 'Vàng Hoe',
      category: 'hair',
      colors: ['#423211', '#73571d', '#aa832d', '#d8b24e', '#f8df85']
    },
    {
      id: 'hair_red',
      name: 'Đỏ Hung',
      category: 'hair',
      colors: ['#3b110a', '#691d12', '#9f2e1e', '#cf4c38', '#f27c69']
    },
    {
      id: 'hair_raven',
      name: 'Đen Tuyền',
      category: 'hair',
      colors: ['#14171a', '#24292e', '#39414a', '#545f6b', '#7a8896']
    },
    {
      id: 'hair_silver',
      name: 'Bạch Kim',
      category: 'hair',
      colors: ['#2a2c30', '#474b52', '#727883', '#a3abb8', '#d5dbe4']
    },
    {
      id: 'hair_blue',
      name: 'Xanh Lam Anime',
      category: 'hair',
      colors: ['#0f2537', '#173f60', '#215f91', '#3286cb', '#69b4f2']
    }
  ],
  torso: [
    {
      id: 'torso_steel_blue',
      name: 'Thép Xanh',
      category: 'torso',
      colors: ['#182333', '#273b54', '#3d5c82', '#5881b5', '#7eaae6']
    },
    {
      id: 'torso_golden',
      name: 'Vàng Kim Hoàng Gia',
      category: 'torso',
      colors: ['#38290a', '#5e4511', '#8c6819', '#c4972e', '#f5cc5b']
    },
    {
      id: 'torso_crimson',
      name: 'Đỏ Thắm Hiệp Sĩ',
      category: 'torso',
      colors: ['#360e15', '#591622', '#8c2436', '#c2384f', '#f06279']
    },
    {
      id: 'torso_emerald',
      name: 'Xanh Lục Ngọc',
      category: 'torso',
      colors: ['#0d2919', '#17472c', '#246b43', '#399e65', '#5fd48f']
    },
    {
      id: 'torso_iron_black',
      name: 'Sắt Đen Huyền',
      category: 'torso',
      colors: ['#111317', '#1f232b', '#313745', '#495266', '#6c778f']
    },
    {
      id: 'torso_cloth_white',
      name: 'Vải Trắng Tinh',
      category: 'torso',
      colors: ['#474b54', '#6c7280', '#99a1b3', '#cdd4e3', '#f3f6fc']
    }
  ],
  legs: [
    {
      id: 'legs_leather_brown',
      name: 'Da Nâu',
      category: 'legs',
      colors: ['#1d140e', '#332318', '#523826', '#755137', '#9c6f4c']
    },
    {
      id: 'legs_dark_iron',
      name: 'Sắt Xám Tối',
      category: 'legs',
      colors: ['#15171a', '#26292e', '#3c4147', '#575d66', '#79808a']
    },
    {
      id: 'legs_blue_denim',
      name: 'Xanh Chàm Đậm',
      category: 'legs',
      colors: ['#121b2b', '#1d2c45', '#2c436b', '#3e6099', '#5883cb']
    },
    {
      id: 'legs_khaki',
      name: 'Vàng Kaki',
      category: 'legs',
      colors: ['#2e291b', '#4d442c', '#756743', '#a3905e', '#cfbb84']
    }
  ],
  feet: [
    {
      id: 'feet_brown',
      name: 'Ủng Da Nâu Cổ Điển',
      category: 'feet',
      colors: ['#211812', '#362419', '#543926', '#7a5538', '#a87850']
    },
    {
      id: 'feet_black',
      name: 'Ủng Da Đen Tuyền',
      category: 'feet',
      colors: ['#121417', '#1f2429', '#313840', '#49525c', '#697482']
    },
    {
      id: 'feet_red',
      name: 'Ủng Da Đỏ Rượu',
      category: 'feet',
      colors: ['#300f12', '#52171c', '#7d242c', '#a8343f', '#cc4754']
    },
    {
      id: 'feet_iron',
      name: 'Ủng Bọc Sắt Xám',
      category: 'feet',
      colors: ['#1d2126', '#303740', '#4c5663', '#6f7c8c', '#98a6b8']
    }
  ],
  hat: [
    {
      id: 'hat_steel',
      name: 'Mũ Thép Xanh',
      category: 'hat',
      colors: ['#182333', '#273b54', '#3d5c82', '#5881b5', '#7eaae6']
    },
    {
      id: 'hat_gold',
      name: 'Mũ Vàng Hoàng Kim',
      category: 'hat',
      colors: ['#3b2a0c', '#694a12', '#9f721e', '#cf9c34', '#f5ca62']
    },
    {
      id: 'hat_dark',
      name: 'Mũ Sắt Đen Tuyền',
      category: 'hat',
      colors: ['#14171a', '#22272e', '#373e47', '#525c69', '#737f8f']
    },
    {
      id: 'hat_crimson',
      name: 'Mũ Đỏ Chiến Binh',
      category: 'hat',
      colors: ['#360f15', '#5e1722', '#8c2434', '#bd3549', '#e05369']
    }
  ],
  body: [
    {
      id: 'body_fair',
      name: 'Da Sáng Tự Nhiên',
      category: 'body',
      colors: ['#8f563b', '#c28569', '#e0a98b', '#f2cbb3', '#ffe4d4']
    },
    {
      id: 'body_tan',
      name: 'Da Bánh Mật',
      category: 'body',
      colors: ['#6b3b24', '#965636', '#b87049', '#d18b62', '#e8ab85']
    },
    {
      id: 'body_dark',
      name: 'Da Ngăm Đen',
      category: 'body',
      colors: ['#3b2216', '#593422', '#78472f', '#965c3e', '#b87552']
    },
    {
      id: 'body_pale',
      name: 'Bạch Tuyết (Pale)',
      category: 'body',
      colors: ['#6e5659', '#9e7f84', '#c9a9af', '#edd1d6', '#fff0f3']
    }
  ]
};


// Chuyển đổi màu Hex sang RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Chuyển đổi RGB sang Hex
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

// Tính khoảng cách màu Euclidean giữa 2 màu RGB
function colorDistanceSq(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

// Thuật toán thay thế dải màu giữ nguyên bóng khối (Palette Ramp Shading Swap)
// Nhận vào Canvas gốc, dải màu nguồn và dải màu đích, trả về Canvas mới đã đổi màu hoàn chỉnh
export function recolorCanvasByPalette(
  sourceCanvas: HTMLCanvasElement,
  sourceColors: string[],
  targetColors: string[]
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Tạo Canvas kết quả độc lập
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return sourceCanvas;

  // Nếu hai bảng màu giống hệt nhau hoặc độ dài không khớp, sao chép nguyên trạng
  if (sourceColors.length === 0 || targetColors.length === 0 || sourceColors.join('') === targetColors.join('')) {
    outCtx.drawImage(sourceCanvas, 0, 0);
    return outCanvas;
  }

  // Đọc dữ liệu điểm ảnh nguồn
  const srcCtx = sourceCanvas.getContext('2d');
  if (!srcCtx) return sourceCanvas;
  const imgData = srcCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Tiền tính toán giá trị RGB cho bảng màu nguồn và đích
  const srcRgbList = sourceColors.map(hexToRgb);
  const tgtRgbList = targetColors.map(hexToRgb);

  // Ngưỡng khoảng cách tối đa để chấp nhận là thuộc dải màu (tránh đổi nhầm viền đen hoặc điểm nhấn)
  const maxToleranceSq = 35 * 35; // Khoảng cách màu cho phép

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    // Bỏ qua pixel trong suốt
    if (a < 15) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Bỏ qua các pixel viền đen gần như tuyệt đối (outline đen của pixel art)
    if (r < 15 && g < 15 && b < 15) continue;

    // Tìm bậc màu gần nhất trong dải nguồn
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let cIdx = 0; cIdx < srcRgbList.length; cIdx++) {
      const srcColor = srcRgbList[cIdx];
      const dist = colorDistanceSq(r, g, b, srcColor.r, srcColor.g, srcColor.b);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = cIdx;
      }
    }

    // Nếu tìm thấy bậc màu tương đồng trong dải nguồn
    if (bestIdx !== -1 && bestDist <= maxToleranceSq) {
      // Ánh xạ sang bậc màu tương ứng trong dải đích
      // Nếu dải đích có số bậc khác dải nguồn, tính tỷ lệ tương ứng
      let targetIdx = bestIdx;
      if (tgtRgbList.length !== srcRgbList.length) {
        targetIdx = Math.round((bestIdx / (srcRgbList.length - 1)) * (tgtRgbList.length - 1));
      }
      targetIdx = Math.max(0, Math.min(tgtRgbList.length - 1, targetIdx));

      const tgt = tgtRgbList[targetIdx];
      data[i] = tgt.r;
      data[i + 1] = tgt.g;
      data[i + 2] = tgt.b;
      // Alpha giữ nguyên 100%
    }
  }

  outCtx.putImageData(imgData, 0, 0);
  return outCanvas;
}

// Lấy danh sách bảng màu cho danh mục phụ kiện
export function getPalettesByCategory(category: string): PaletteRamp[] {
  if (category in LPC_PALETTES) {
    return LPC_PALETTES[category as LpcPaletteCategory];
  }
  return [];
}


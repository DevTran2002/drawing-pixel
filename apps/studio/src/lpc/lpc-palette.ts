// apps/studio/src/lpc/lpc-palette.ts
// Module định nghĩa các bảng màu dải bậc (Palette Color Ramps) chuẩn LPC
// và thuật toán ánh xạ màu giữ nguyên bóng khối (Palette Recolor & Shading)

export type LpcPaletteCategory = 'hair' | 'torso' | 'legs' | 'feet' | 'hat' | 'tails' | 'ears' | 'body' | 'cape' | 'weapons' | 'shield' | 'belt';

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
  // Dải màu ủng chuẩn LPC gốc (boots_leather và boots_fold dùng dải xám tím này)
  feet: ['#281820', '#4d4a5d', '#958080', '#c4b59f', '#e5e6c7'],
  // Dải màu mũ sắt chuẩn LPC gốc
  hat: ['#1d131e', '#4d4a5d', '#726b7e', '#867e7f', '#c4b59f', '#ffffff'],
  // Dải màu đuôi thú chuẩn LPC gốc
  tails: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00'],
  // Dải màu tai thú chuẩn LPC gốc
  ears: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00'],
  // Dải màu da sáng cơ bản
  body: ['#8f563b', '#c28569', '#e0a98b', '#f2cbb3', '#ffe4d4'],
  // Dải màu áo choàng
  cape: ['#2b1118', '#5c1726', '#8f2337', '#bd354e', '#e65e77'],
  // Dải màu vũ khí kiếm
  weapons: ['#1f242b', '#3b434f', '#647285', '#9bb0cc', '#e2edfa'],
  // Dải màu khiên
  shield: ['#2d1b10', '#54331e', '#7d4f30', '#a87349', '#d19f6e'],
  // Dải màu thắt lưng
  belt: ['#24150d', '#422718', '#663d26', '#8f5737', '#bd774c']
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
    },
    {
      id: 'torso_dragon_flame',
      name: 'Giáp Rồng Lửa Nham Thạch',
      category: 'torso',
      colors: ['#2e0a0a', '#5c1414', '#991b1b', '#dc2626', '#f97316', '#fef08a']
    },
    {
      id: 'torso_cyber_neon',
      name: 'Thép Xanh Cyberpunk Neon',
      category: 'torso',
      colors: ['#0f172a', '#0369a1', '#0284c7', '#38bdf8', '#67e8f9']
    },
    {
      id: 'torso_void_purple',
      name: 'Áo Choàng Tím Hư Không',
      category: 'torso',
      colors: ['#1e102d', '#3b1d5c', '#6b21a8', '#a855f7', '#e9d5ff']
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
    },
    {
      id: 'legs_dragon_scale',
      name: 'Quần Vảy Rồng Lửa',
      category: 'legs',
      colors: ['#1f1414', '#3d1b1b', '#6b2121', '#991b1b', '#c2410c']
    },
    {
      id: 'legs_cyber_black',
      name: 'Quần Chiến Binh Cyberpunk',
      category: 'legs',
      colors: ['#090d16', '#111827', '#1e293b', '#38bdf8', '#7dd3fc']
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
    },
    {
      id: 'feet_dragon',
      name: 'Ủng Giáp Rồng Lửa',
      category: 'feet',
      colors: ['#260d0d', '#4d1414', '#7f1d1d', '#b91c1c', '#f59e0b']
    },
    {
      id: 'feet_cyber',
      name: 'Ủng Thép Cyberpunk',
      category: 'feet',
      colors: ['#0f172a', '#1e293b', '#334155', '#0284c7', '#38bdf8']
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
    },
    {
      id: 'hat_dragon',
      name: 'Mũ Sừng Rồng Lửa',
      category: 'hat',
      colors: ['#2e0a0a', '#5c1414', '#991b1b', '#dc2626', '#f97316', '#fef08a']
    },
    {
      id: 'hat_cyber',
      name: 'Mũ Kính Cyberpunk Neon',
      category: 'hat',
      colors: ['#0f172a', '#0369a1', '#0284c7', '#38bdf8', '#67e8f9']
    }
  ],
  tails: [
    {
      id: 'fur_orange',
      name: 'Lông Cam Tự Nhiên',
      category: 'tails',
      colors: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00']
    },
    {
      id: 'fur_black',
      name: 'Lông Đen Tuyền',
      category: 'tails',
      colors: ['#121417', '#1f2429', '#313840', '#49525c', '#697482']
    },
    {
      id: 'fur_white',
      name: 'Lông Bạch Tuyết',
      category: 'tails',
      colors: ['#3a3e47', '#5f6675', '#8a94a6', '#bdc7d8', '#f0f4fa']
    },
    {
      id: 'fur_brown',
      name: 'Lông Nâu Đất',
      category: 'tails',
      colors: ['#211812', '#362419', '#543926', '#7a5538', '#a87850']
    }
  ],
  ears: [
    {
      id: 'ear_orange',
      name: 'Tai Cam Tự Nhiên',
      category: 'ears',
      colors: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00']
    },
    {
      id: 'ear_black',
      name: 'Tai Đen Tuyền',
      category: 'ears',
      colors: ['#121417', '#1f2429', '#313840', '#49525c', '#697482']
    },
    {
      id: 'ear_white',
      name: 'Tai Bạch Tuyết',
      category: 'ears',
      colors: ['#3a3e47', '#5f6675', '#8a94a6', '#bdc7d8', '#f0f4fa']
    },
    {
      id: 'ear_brown',
      name: 'Tai Nâu Đất',
      category: 'ears',
      colors: ['#211812', '#362419', '#543926', '#7a5538', '#a87850']
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
  ],
  cape: [
    {
      id: 'cape_crimson',
      name: 'Đỏ Rượu Hoàng Gia',
      category: 'cape',
      colors: ['#2e0c14', '#591624', '#8a2036', '#ba2f4c', '#e34d6d']
    },
    {
      id: 'cape_royal_blue',
      name: 'Xanh Lam Kỵ Sĩ',
      category: 'cape',
      colors: ['#0f172a', '#1e3a8a', '#2563eb', '#60a5fa', '#93c5fd']
    },
    {
      id: 'cape_dark_shadow',
      name: 'Đen Bóng Đêm',
      category: 'cape',
      colors: ['#0a0b0d', '#181b20', '#2d323b', '#48505e', '#6e798c']
    },
    {
      id: 'cape_emerald',
      name: 'Lục Bảo Rừng Già',
      category: 'cape',
      colors: ['#062419', '#0d4a34', '#157a55', '#22a877', '#4ade80']
    }
  ],
  weapons: [
    {
      id: 'weapon_steel',
      name: 'Thép Bạc Sáng',
      category: 'weapons',
      colors: ['#1f242b', '#3b434f', '#647285', '#9bb0cc', '#e2edfa']
    },
    {
      id: 'weapon_gold',
      name: 'Hoàng Kim Thánh Tích',
      category: 'weapons',
      colors: ['#382405', '#6b470c', '#a87319', '#e0a028', '#fce28b']
    },
    {
      id: 'weapon_fire',
      name: 'Hỏa Long Chấn Thiên',
      category: 'weapons',
      colors: ['#380b0b', '#731717', '#b52424', '#f04343', '#ff9436']
    }
  ],
  shield: [
    {
      id: 'shield_wood_iron',
      name: 'Gỗ Sồi Viền Thép',
      category: 'shield',
      colors: ['#24150b', '#472a15', '#734422', '#a16335', '#cca378']
    },
    {
      id: 'shield_steel_blue',
      name: 'Khiên Thép Xanh',
      category: 'shield',
      colors: ['#141d26', '#253545', '#3e566e', '#6082a6', '#92b3d9']
    }
  ],
  belt: [
    {
      id: 'belt_leather_brown',
      name: 'Da Nâu Khóa Đồng',
      category: 'belt',
      colors: ['#24150d', '#422718', '#663d26', '#8f5737', '#bd774c']
    },
    {
      id: 'belt_black_steel',
      name: 'Da Đen Khóa Thép',
      category: 'belt',
      colors: ['#111317', '#20242b', '#353c47', '#505a69', '#758194']
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

// Chuyển đổi RGB sang HSL
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Chuyển đổi HSL sang RGB
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

// Tự động sinh ra dải Ramp bóng khối 5-6 bậc từ một mã màu Hex tùy chọn
export function generateRampFromHex(baseHex: string, category?: string): string[] {
  const rgb = hexToRgb(baseHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Quy chuẩn số bậc màu theo category nguồn:
  // hair: 6 bậc, torso: 6 bậc, hat: 6 bậc, legs: 5 bậc, feet: 5 bậc, cape: 5 bậc, weapons: 5 bậc
  const numSteps = (category === 'hair' || category === 'torso' || category === 'hat') ? 6 : 5;

  const ramp: string[] = [];
  if (numSteps === 6) {
    // 6 bậc: Cực tối -> Bóng đậm -> Bóng trung -> Màu chính -> Sáng highlight -> Điểm lóa phản quang
    const steps = [
      { lMul: 0.22, sMul: 1.15, hShift: -8 }, // Bậc 0: Deep Shadow (Hue dịch lạnh)
      { lMul: 0.45, sMul: 1.10, hShift: -4 }, // Bậc 1: Medium Shadow
      { lMul: 0.72, sMul: 1.05, hShift: -2 }, // Bậc 2: Soft Shadow
      { lMul: 1.00, sMul: 1.00, hShift: 0 },  // Bậc 3: Base color (Màu chính người dùng chọn)
      { lMul: 1.35, sMul: 0.85, hShift: 4 },  // Bậc 4: Highlight (Hue dịch ấm)
      { lMul: 1.70, sMul: 0.50, hShift: 8 }   // Bậc 5: Specular Glow
    ];

    for (const step of steps) {
      let newL = Math.max(5, Math.min(95, hsl.l * step.lMul));
      if (step.lMul > 1) {
        newL = Math.min(96, hsl.l + (100 - hsl.l) * (step.lMul - 1));
      }
      const newS = Math.max(0, Math.min(100, hsl.s * step.sMul));
      const newH = (hsl.h + step.hShift + 360) % 360;
      const c = hslToRgb(newH, newS, newL);
      ramp.push(rgbToHex(c.r, c.g, c.b));
    }
  } else {
    // 5 bậc: Bóng tối đậm -> Bóng trung -> Màu chính -> Sáng -> Sáng lóa
    const steps = [
      { lMul: 0.26, sMul: 1.15, hShift: -6 },
      { lMul: 0.58, sMul: 1.08, hShift: -3 },
      { lMul: 1.00, sMul: 1.00, hShift: 0 },
      { lMul: 1.38, sMul: 0.82, hShift: 4 },
      { lMul: 1.75, sMul: 0.45, hShift: 7 }
    ];

    for (const step of steps) {
      let newL = Math.max(6, Math.min(95, hsl.l * step.lMul));
      if (step.lMul > 1) {
        newL = Math.min(96, hsl.l + (100 - hsl.l) * (step.lMul - 1));
      }
      const newS = Math.max(0, Math.min(100, hsl.s * step.sMul));
      const newH = (hsl.h + step.hShift + 360) % 360;
      const c = hslToRgb(newH, newS, newL);
      ramp.push(rgbToHex(c.r, c.g, c.b));
    }
  }

  return ramp;
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

// Cấu trúc định nghĩa một Bộ Phối Màu Trang Phục Hoàn Chỉnh (Character Costume Theme)
export interface CharacterPaletteTheme {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  palettes: {
    torso?: string;
    legs?: string;
    feet?: string;
    hat?: string;
    hair?: string;
    body?: string;
  };
}

// Danh sách các bộ Trang Phục Chủ Đề chuẩn mực (100% đồng nhất chi tiết trên toàn bộ các khung hình)
export const CHARACTER_THEMES: CharacterPaletteTheme[] = [
  {
    id: 'theme_paladin',
    name: 'Hiệp Sĩ Thánh Paladin (Vàng Kim)',
    description: 'Giáp vàng kim hoàng gia rực sáng, quần sắt xám tối, ủng bọc sắt và tóc vàng hoe chuẩn mực.',
    keywords: ['paladin', 'thánh', 'hoàng gia', 'vàng kim', 'holy', 'royal', 'gold'],
    palettes: {
      torso: 'torso_golden',
      legs: 'legs_dark_iron',
      feet: 'feet_iron',
      hat: 'hat_gold',
      hair: 'hair_blonde'
    }
  },
  {
    id: 'theme_dragon',
    name: 'Chiến Binh Giáp Rồng Lửa (Flame Dragon)',
    description: 'Giáp đỏ thẫm viền lửa nham thạch, quần vảy rồng, ủng giáp rồng và tóc đỏ rực lửa.',
    keywords: ['rồng', 'dragon', 'lửa', 'flame', 'lava', 'đỏ', 'fire'],
    palettes: {
      torso: 'torso_dragon_flame',
      legs: 'legs_dragon_scale',
      feet: 'feet_dragon',
      hat: 'hat_dragon',
      hair: 'hair_red'
    }
  },
  {
    id: 'theme_cyberpunk',
    name: 'Chiến Binh Cyberpunk Neon',
    description: 'Giáp thép xanh neon công nghệ cao, quần chàm tối và tóc xanh anime tương lai.',
    keywords: ['cyber', 'cyberpunk', 'neon', 'công nghệ', 'tương lai', 'futuristic'],
    palettes: {
      torso: 'torso_cyber_neon',
      legs: 'legs_cyber_black',
      feet: 'feet_cyber',
      hat: 'hat_cyber',
      hair: 'hair_blue'
    }
  },
  {
    id: 'theme_void_wizard',
    name: 'Phù Thủy Hư Không (Void Mystic)',
    description: 'Áo choàng tím huyền bí, quần sắt đen, ủng da đen và tóc bạch kim.',
    keywords: ['phù thủy', 'wizard', 'mystic', 'hư không', 'void', 'tím', 'purple', 'magic'],
    palettes: {
      torso: 'torso_void_purple',
      legs: 'legs_dark_iron',
      feet: 'feet_black',
      hat: 'hat_dark',
      hair: 'hair_silver'
    }
  },
  {
    id: 'theme_shadow_assassin',
    name: 'Sát Thủ Bóng Đêm (Shadow Assassin)',
    description: 'Giáp sắt đen huyền tàng hình, quần tối màu, ủng da đen và tóc đen tuyền.',
    keywords: ['sát thủ', 'ninja', 'bóng đêm', 'shadow', 'assassin', 'đen', 'dark', 'black'],
    palettes: {
      torso: 'torso_iron_black',
      legs: 'legs_dark_iron',
      feet: 'feet_black',
      hat: 'hat_dark',
      hair: 'hair_raven'
    }
  },
  {
    id: 'theme_royal_knight',
    name: 'Hiệp Sĩ Thép Xanh Hoàng Gia',
    description: 'Bộ giáp thép xanh hiệp sĩ cổ điển, quần da nâu và tóc nâu tự nhiên.',
    keywords: ['hiệp sĩ', 'knight', 'thép xanh', 'steel', 'blue'],
    palettes: {
      torso: 'torso_steel_blue',
      legs: 'legs_leather_brown',
      feet: 'feet_brown',
      hat: 'hat_steel',
      hair: 'hair_brown'
    }
  },
  {
    id: 'theme_emerald_ranger',
    name: 'Kiếm Sĩ Ngọc Lục Bảo (Emerald Ranger)',
    description: 'Giáp ngọc lục bảo rừng sâu, quần kaki và tóc bạch kim.',
    keywords: ['ngọc', 'lục bảo', 'emerald', 'xanh lá', 'green', 'ranger', 'rừng'],
    palettes: {
      torso: 'torso_emerald',
      legs: 'legs_khaki',
      feet: 'feet_brown',
      hat: 'hat_dark',
      hair: 'hair_silver'
    }
  }
];

// Hàm tìm Theme phù hợp nhất dựa trên Prompt văn bản của người dùng
export function findThemeByPrompt(prompt: string): CharacterPaletteTheme | null {
  const cleanPrompt = prompt.toLowerCase();
  for (const theme of CHARACTER_THEMES) {
    for (const kw of theme.keywords) {
      if (cleanPrompt.includes(kw.toLowerCase())) {
        return theme;
      }
    }
  }
  return null;
}



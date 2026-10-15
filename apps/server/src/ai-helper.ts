// apps/server/src/ai-helper.ts
// Module xu ly ket noi voi mo hinh AI LoRA Stardew Valley va doc anh pixel PNG

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { PNG } from 'pngjs';
import { PixelPoint } from '@pixel-draw/shared-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tim thu muc goc cua du an (d:\pixel_draw)
function getProjectRoot(): string {
  let cur = __dirname;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json')) && fs.existsSync(path.join(cur, 'apps'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return process.cwd();
}

// Doc du lieu diem anh tu tep anh PNG vao danh sach PixelPoint
export function loadPngToPixels(imagePath: string): { width: number; height: number; pixels: PixelPoint[] } {
  let resolvedPath = imagePath;
  if (!path.isAbsolute(resolvedPath)) {
    const projectRoot = getProjectRoot();
    const storagePath = path.join(projectRoot, 'storage', 'outputs', imagePath);
    if (fs.existsSync(storagePath)) {
      resolvedPath = storagePath;
    } else {
      resolvedPath = path.join(projectRoot, imagePath);
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Khong tim thay tep anh tai: ${resolvedPath}`);
  }

  const buf = fs.readFileSync(resolvedPath);
  const png = PNG.sync.read(buf);

  const pixels: PixelPoint[] = [];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];

      // Chi lay cac pixel khong trong suot (Alpha > 20)
      if (a > 20) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        pixels.push({ x, y, color: hex });
      }
    }
  }

  return { width: png.width, height: png.height, pixels };
}

// Ham xac dinh lenh chay uv tren Windows/Linux de tranh loi 'uv' is not recognized
function th_get_uv_command(): string {
  const localAppData = process.env.LOCALAPPDATA || '';
  if (localAppData) {
    const storeUvPath = path.join(
      localAppData,
      'Packages',
      'PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0',
      'LocalCache',
      'local-packages',
      'Python310',
      'Scripts',
      'uv.exe'
    );
    if (fs.existsSync(storeUvPath)) {
      return `"${storeUvPath}"`;
    }
  }
  return 'python -m uv';
}

// Goi script Python de sinh anh chan dung moi bang mo hinh LoRA
export function generateStardewPortrait(prompt: string, steps = 22, size = 64, removeBg = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const projectRoot = getProjectRoot();
    const pythonScript = path.join(projectRoot, 'scripts', 'th_generate_stardew_portrait.py');
    const loraPath = path.join(projectRoot, 'models', 'lora', 'th_stardew_portrait_lora.safetensors');
    const safePrompt = prompt.replace(/"/g, '\\"');
    const uvCmd = th_get_uv_command();
    const removeBgFlag = removeBg ? '--remove_bg' : '';
    const cmd = `${uvCmd} run "${pythonScript}" --lora "${loraPath}" --prompt "${safePrompt}" --steps ${steps} --size ${size} ${removeBgFlag}`.trim();

    console.log(`[AI Engine] Dang chay lenh sinh chan dung LoRA: ${cmd}`);
    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('[AI Engine] Loi khi sinh anh bang LoRA:', stderr || error.message);
        return reject(new Error(stderr || error.message));
      }
      console.log('[AI Engine] Ket qua sinh anh hoan tat.');
      const outputPath = path.join(projectRoot, 'storage', 'outputs', `th_stardew_character_pixel_${size}x${size}.png`);
      resolve(outputPath);
    });
  });
}

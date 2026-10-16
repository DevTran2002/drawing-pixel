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

export interface AiGenerateOptions {
  prompt: string;
  checkpoint?: string;
  loraPath?: string;
  loraScale?: number;
  steps?: number;
  size?: number;
  resample?: 'NEAREST' | 'LANCZOS';
  removeBg?: boolean;
}

// Ham xac dinh trinh thuc thi Python cua moi truong ao .venv
function th_get_python_command(): string {
  const projectRoot = getProjectRoot();
  const venvPythonWin = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPythonWin)) {
    return `"${venvPythonWin}"`;
  }
  const venvPythonUnix = path.join(projectRoot, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPythonUnix)) {
    return `"${venvPythonUnix}"`;
  }
  return 'python';
}

// Goi script Python de sinh anh chan dung/sprite moi bang mo hinh Checkpoint va LoRA
export function generateStardewPortrait(
  opts: AiGenerateOptions | string,
  legacySteps = 16,
  legacySize = 64,
  legacyRemoveBg = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const projectRoot = getProjectRoot();
    const pythonScript = path.join(projectRoot, 'scripts', 'th_generate_stardew_portrait.py');
    const pythonCmd = th_get_python_command();

    let prompt = '';
    let checkpoint = path.join(projectRoot, 'models', 'checkpoints', 'AOM3A1B_orangemixs.safetensors');
    let loraPath = path.join(projectRoot, 'models', 'lora', 'th_stardew_portrait_lora.safetensors');
    let loraScale = 0.55;
    let steps = 16;
    let size = 64;
    let resample = 'NEAREST';
    let removeBg = false;

    if (typeof opts === 'string') {
      prompt = opts;
      steps = legacySteps;
      size = legacySize;
      removeBg = legacyRemoveBg;
    } else {
      prompt = opts.prompt;
      if (opts.checkpoint) {
        checkpoint = path.isAbsolute(opts.checkpoint) ? opts.checkpoint : path.join(projectRoot, opts.checkpoint);
      }
      if (opts.loraPath) {
        loraPath = path.isAbsolute(opts.loraPath) ? opts.loraPath : path.join(projectRoot, opts.loraPath);
      }
      if (opts.loraScale !== undefined) loraScale = opts.loraScale;
      if (opts.steps !== undefined) steps = opts.steps;
      if (opts.size !== undefined) size = opts.size;
      if (opts.resample !== undefined) resample = opts.resample;
      if (opts.removeBg !== undefined) removeBg = opts.removeBg;
    }

    const timestamp = Date.now();
    const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `th_ai_gen_${timestamp}`);
    const safePrompt = prompt.replace(/"/g, '\\"');
    const removeBgFlag = removeBg ? '--remove_bg' : '';

    const cmd = `${pythonCmd} "${pythonScript}" --checkpoint "${checkpoint}" --lora "${loraPath}" --prompt "${safePrompt}" --steps ${steps} --lora_scale ${loraScale} --size ${size} --resample ${resample} --output_prefix "${outputPrefix}" ${removeBgFlag}`.trim();

    console.log(`[AI Engine] Dang chay lenh sinh anh: ${cmd}`);
    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('[AI Engine] Loi khi sinh anh bang LoRA:', stderr || error.message);
        return reject(new Error(stderr || error.message));
      }
      console.log('[AI Engine] Ket qua sinh anh hoan tat.');
      const outputPath = `${outputPrefix}_pixel_${size}x${size}.png`;
      resolve(outputPath);
    });
  });
}

// apps/server/src/ai-helper.ts
// Module xu ly ket noi voi mo hinh AI Checkpoint va LoRA de sinh anh Pixel Art

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { PNG } from 'pngjs';
import { PixelPoint } from '@pixel-draw/shared-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tim thu muc goc cua du an (d:\pixel_draw)
export function getProjectRoot(): string {
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

// Luu danh sach diem anh PixelPoint thanh tep anh PNG
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

export interface AiProgressInfo {
  stage: string;
  step?: number;
  totalSteps?: number;
  percent?: number;
  elapsed?: number;
  eta?: number;
  message?: string;
}

export type AiProgressCallback = (progress: AiProgressInfo) => void;

export interface AiGenerateOptions {
  prompt: string;
  checkpoint?: string;
  loraPath?: string;
  loraScale?: number;
  steps?: number;
  size?: number;
  resample?: 'NEAREST' | 'LANCZOS';
  removeBg?: boolean;
  seed?: number;
  onProgress?: AiProgressCallback;
}

// Ham xac dinh duong dan file thuc thi Python cua moi truong ao .venv
function getPythonCommand(): string {
  const projectRoot = getProjectRoot();
  const venvPythonWin = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }
  const venvPythonUnix = path.join(projectRoot, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPythonUnix)) {
    return venvPythonUnix;
  }
  return 'python';
}

// Goi script Python de sinh anh pixel art moi bang mo hinh Checkpoint va LoRA
export function generatePixelArt(
  opts: AiGenerateOptions | string,
  progressCallbackOrLegacySteps?: AiProgressCallback | number,
  legacySize = 64,
  legacyRemoveBg = false
): Promise<{ outputPath: string; seed?: number }> {
  return new Promise((resolve, reject) => {
    const projectRoot = getProjectRoot();
    const pythonScript = path.join(projectRoot, 'scripts', 'generate_pixel_art.py');
    const pythonExe = getPythonCommand();

    let prompt = '';
    let checkpoint = path.join(projectRoot, 'models', 'checkpoints', 'AOM3A1B_orangemixs.safetensors');
    let loraPath = path.join(projectRoot, 'models', 'lora', 'pixel_portrait_lora.safetensors');
    let loraScale = 0.55;
    let steps = 16;
    let size = 64;
    let resample = 'NEAREST';
    let removeBg = false;
    let seed: number | undefined = undefined;
    let onProgress: AiProgressCallback | undefined = undefined;

    if (typeof progressCallbackOrLegacySteps === 'function') {
      onProgress = progressCallbackOrLegacySteps;
    }

    if (typeof opts === 'string') {
      prompt = opts;
      if (typeof progressCallbackOrLegacySteps === 'number') steps = progressCallbackOrLegacySteps;
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
      if (opts.seed !== undefined) seed = opts.seed;
      if (opts.onProgress) onProgress = opts.onProgress;
    }

    const timestamp = Date.now();
    const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `ai_gen_${timestamp}`);

    const args = [
      '-u', // Che do unbuffered binary stream giup nhan output ngay lap tuc
      pythonScript,
      '--checkpoint', checkpoint,
      '--lora', loraPath,
      '--prompt', prompt,
      '--steps', `${steps}`,
      '--lora_scale', `${loraScale}`,
      '--size', `${size}`,
      '--resample', resample,
      '--output_prefix', outputPrefix
    ];
    if (removeBg) {
      args.push('--remove_bg');
    }
    if (seed !== undefined && seed > 0) {
      args.push('--seed', `${seed}`);
    }

    console.log(`[AI Engine] Dang chay script Python voi spawn: ${pythonExe} ${args.join(' ')}`);

    onProgress?.({
      stage: 'init',
      step: 0,
      totalSteps: steps,
      percent: 0,
      elapsed: 0,
      eta: 0,
      message: 'Đang khởi động tiến trình AI...'
    });

    const child = spawn(pythonExe, args, { cwd: projectRoot });

    let stdoutData = '';
    let stderrData = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 1. Dinh dang step chi tiet: AI_STEP:step:total:percent:elapsed:eta
      if (trimmed.startsWith('AI_STEP:')) {
        const parts = trimmed.split(':');
        if (parts.length >= 6) {
          const step = parseInt(parts[1], 10);
          const totalSteps = parseInt(parts[2], 10);
          const percent = parseInt(parts[3], 10);
          const elapsed = parseFloat(parts[4]);
          const eta = parseFloat(parts[5]);
          onProgress?.({
            stage: 'denoising',
            step,
            totalSteps,
            percent,
            elapsed,
            eta,
            message: `Đang sinh ảnh: Bước ${step}/${totalSteps} (${percent}%)`
          });
        }
      }
      // 2. Dinh dang stage: AI_STAGE:stage_name:message
      else if (trimmed.startsWith('AI_STAGE:')) {
        const parts = trimmed.split(':');
        const stage = (parts[1] || 'processing').toLowerCase();
        const message = parts.slice(2).join(':');

        if (stage === 'seed') {
          const match = message.match(/(\d+)/);
          if (match) {
            seed = parseInt(match[1], 10);
          }
        }

        onProgress?.({
          stage,
          message
        });
      }
      // 3. Fallback nhan dien tqdm tu stderr
      else {
        const tqdmMatch = trimmed.match(/(\d+)\/(\d+)\s*\[([^<]+)<([^,]+),\s*([^\]]+)\]/);
        if (tqdmMatch) {
          const step = parseInt(tqdmMatch[1], 10);
          const totalSteps = parseInt(tqdmMatch[2], 10);
          if (totalSteps <= 60) {
            const pct = Math.round((step / totalSteps) * 100);
            const elapsedStr = tqdmMatch[3].trim();
            const etaStr = tqdmMatch[4].trim();
            const parseSec = (s: string) => {
              const p = s.split(':').map(Number);
              return p.length === 2 ? p[0] * 60 + p[1] : 0;
            };
            onProgress?.({
              stage: 'denoising',
              step,
              totalSteps,
              percent: pct,
              elapsed: parseSec(elapsedStr),
              eta: parseSec(etaStr),
              message: `Đang sinh ảnh: Bước ${step}/${totalSteps} (${pct}%)`
            });
          }
        }
      }
    };

    let stdoutBuffer = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutData += text;
      stdoutBuffer += text;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split(/[\r\n]+/);
      stderrBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    child.on('error', (err) => {
      console.error('[AI Engine] Loi khi spawn tien trinh Python:', err);
      reject(err);
    });

    child.on('close', (code) => {
      if (stdoutBuffer) handleLine(stdoutBuffer);
      if (stderrBuffer) handleLine(stderrBuffer);

      if (code !== 0) {
        console.error(`[AI Engine] Tien trinh thoat voi ma loi ${code}:`, stderrData || stdoutData);
        return reject(new Error(stderrData || stdoutData || `Tiến trình Python thoát với mã lỗi ${code}`));
      }

      console.log('[AI Engine] Ket qua sinh anh hoan tat.');
      onProgress?.({
        stage: 'completed',
        percent: 100,
        message: 'Sinh ảnh hoàn tất!'
      });

      const outputPath = `${outputPrefix}_pixel_${size}x${size}.png`;
      resolve({ outputPath, seed });
    });
  });
}

export interface AiAnimationOptions {
  basePrompt: string;
  action: string;
  frameCount: number;
  seed?: number;
  checkpoint?: string;
  loraPath?: string;
  loraScale?: number;
  steps?: number;
  size?: number;
  resample?: 'NEAREST' | 'LANCZOS';
  removeBg?: boolean;
  basePixels?: PixelPoint[];
  initImage?: string;
  strength?: number;
  onProgress?: AiProgressCallback;
}

export interface AnimationFrameResult {
  frameIndex: number;
  width: number;
  height: number;
  pixels: PixelPoint[];
  filename: string;
  imagePath: string;
}

export interface AiAnimationResult {
  frameCount: number;
  action: string;
  frames: AnimationFrameResult[];
  metaPath: string;
}

// Sinh chuoi hoat anh SpriteSheet dong bo va cat thanh cac frames
export function generateSpriteAnimation(opts: AiAnimationOptions): Promise<AiAnimationResult> {
  return new Promise((resolve, reject) => {
    const projectRoot = getProjectRoot();
    const pythonScript = path.join(projectRoot, 'scripts', 'generate_pixel_art.py');
    const pythonExe = getPythonCommand();

    const basePrompt = opts.basePrompt || '16-bit rpg hero, warrior';
    const action = opts.action || 'walk';
    const frameCount = opts.frameCount || 4;
    const checkpoint = opts.checkpoint ? (path.isAbsolute(opts.checkpoint) ? opts.checkpoint : path.join(projectRoot, opts.checkpoint)) : path.join(projectRoot, 'models', 'checkpoints', 'AOM3A1B_orangemixs.safetensors');
    
    // Uu tien dung LoRA 2D Pixel Toolkit chuyen dung cho game sprite sheet
    const toolkitLora = path.join(projectRoot, 'models', 'lora', '2d_pixel_sprites_64.safetensors');
    const defaultLora = fs.existsSync(toolkitLora) ? toolkitLora : path.join(projectRoot, 'models', 'lora', 'pixel_f2.safetensors');
    const loraPath = opts.loraPath ? (path.isAbsolute(opts.loraPath) ? opts.loraPath : path.join(projectRoot, opts.loraPath)) : defaultLora;
    const isToolkit = loraPath.includes('2d_pixel_sprites');
    const loraScale = opts.loraScale !== undefined ? opts.loraScale : (isToolkit ? 0.85 : 0.65);
    const steps = opts.steps || (isToolkit ? 20 : 18);
    const size = opts.size || 64;
    const resample = opts.resample || 'NEAREST';
    const removeBg = opts.removeBg ?? true;
    const onProgress = opts.onProgress;

    const timestamp = Date.now();
    const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `ai_anim_${timestamp}`);

    let tempRefCharPath: string | undefined = undefined;
    if (opts.initImage && fs.existsSync(opts.initImage)) {
      tempRefCharPath = opts.initImage;
    } else if (opts.basePixels && opts.basePixels.length > 0) {
      tempRefCharPath = path.join(projectRoot, 'storage', 'outputs', `temp_ref_char_${timestamp}.png`);
      savePixelsToPng(opts.basePixels, size, size, tempRefCharPath);
    }

    const args = [
      '-u',
      pythonScript,
      '--checkpoint', checkpoint,
      '--lora', loraPath,
      '--prompt', basePrompt,
      '--steps', `${steps}`,
      '--lora_scale', `${loraScale}`,
      '--size', `${size}`,
      '--resample', resample,
      '--output_prefix', outputPrefix,
      '--animation_mode',
      '--frame_count', `${frameCount}`,
      '--action', action
    ];

    if (tempRefCharPath) {
      args.push('--init_image', tempRefCharPath);
      const actualStrength = opts.strength !== undefined ? opts.strength : 0.62;
      args.push('--strength', `${actualStrength}`);
    }

    if (removeBg) {
      args.push('--remove_bg');
    }
    if (opts.seed !== undefined && opts.seed > 0) {
      args.push('--seed', `${opts.seed}`);
    }

    console.log(`[AI Animation] Dang chay script tao chuoi hoat anh: ${pythonExe} ${args.join(' ')}`);

    const hasRef = Boolean(tempRefCharPath);
    onProgress?.({
      stage: 'init',
      step: 0,
      totalSteps: steps,
      percent: 0,
      elapsed: 0,
      eta: 0,
      message: hasRef
        ? `Đang tạo SpriteSheet tham chiếu nhân vật mẫu (${action}, ${frameCount} frames)...`
        : `Đang khởi tạo chu kỳ ${action} (${frameCount} frames)...`
    });

    const child = spawn(pythonExe, args, { cwd: projectRoot });

    let stdoutData = '';
    let stderrData = '';
    let metaPathResult = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('AI_STEP:')) {
        const parts = trimmed.split(':');
        if (parts.length >= 6) {
          const step = parseInt(parts[1], 10);
          const totalSteps = parseInt(parts[2], 10);
          const percent = parseInt(parts[3], 10);
          const elapsed = parseFloat(parts[4]);
          const eta = parseFloat(parts[5]);
          onProgress?.({
            stage: 'denoising',
            step,
            totalSteps,
            percent,
            elapsed,
            eta,
            message: `Đang tạo SpriteSheet: Bước ${step}/${totalSteps} (${percent}%)`
          });
        }
      } else if (trimmed.startsWith('AI_STAGE:SLICE:')) {
        onProgress?.({
          stage: 'slicing',
          percent: 92,
          message: `Đang tự động bóc tách ${frameCount} khung hình chuyển động...`
        });
      } else if (trimmed.startsWith('AI_ANIM_RESULT:')) {
        metaPathResult = trimmed.replace('AI_ANIM_RESULT:', '').trim();
      }
    };

    let stdoutBuffer = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutData += text;
      stdoutBuffer += text;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split(/[\r\n]+/);
      stderrBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    child.on('error', (err) => {
      console.error('[AI Animation] Loi spawn tien trinh Python:', err);
      reject(err);
    });

    child.on('close', (code) => {
      if (stdoutBuffer) handleLine(stdoutBuffer);
      if (stderrBuffer) handleLine(stderrBuffer);

      if (code !== 0) {
        console.error(`[AI Animation] Tien trinh thoat voi ma loi ${code}:`, stderrData || stdoutData);
        return reject(new Error(stderrData || stdoutData || `Tiến trình Python thoát với mã lỗi ${code}`));
      }

      const metaPath = metaPathResult || `${outputPrefix}_anim_meta.json`;
      if (!fs.existsSync(metaPath)) {
        return reject(new Error(`Không tìm thấy file metadata hoạt ảnh tại: ${metaPath}`));
      }

      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        const frameFiles: string[] = meta.frameFiles || [];

        const frames: AnimationFrameResult[] = frameFiles.map((fPath, idx) => {
          const loaded = loadPngToPixels(fPath);
          return {
            frameIndex: idx,
            width: loaded.width,
            height: loaded.height,
            pixels: loaded.pixels,
            filename: path.basename(fPath),
            imagePath: fPath
          };
        });

        onProgress?.({
          stage: 'completed',
          percent: 100,
          message: `Hoàn tất tạo ${frames.length} frames hoạt cảnh!`
        });

        resolve({
          frameCount: frames.length,
          action,
          frames,
          metaPath
        });
      } catch (err: any) {
        reject(new Error(`Lỗi đọc dữ liệu frames hoạt cảnh: ${err.message}`));
      }
    });
  });
}

export interface AiRefineAnimationOptions {
  metaPath: string;
  basePrompt?: string;
  action?: string;
  strength?: number;
  seed?: number;
  checkpoint?: string;
  loraPath?: string;
  loraScale?: number;
  steps?: number;
  size?: number;
  removeBg?: boolean;
  onProgress?: AiProgressCallback;
}

// Ham dung mo hinh AI Img2Img khau lien cac diem rach va nếp gap trang phuc tu cac frames khung xuong
export function refineAnimationWithAi(opts: AiRefineAnimationOptions): Promise<AiAnimationResult> {
  return new Promise((resolve, reject) => {
    const projectRoot = getProjectRoot();
    const pythonScript = path.join(projectRoot, 'scripts', 'generate_pixel_art.py');
    const pythonExe = getPythonCommand();

    const basePrompt = opts.basePrompt || 'pixel art character';
    const action = opts.action || 'walk';
    const checkpoint = opts.checkpoint ? (path.isAbsolute(opts.checkpoint) ? opts.checkpoint : path.join(projectRoot, opts.checkpoint)) : path.join(projectRoot, 'models', 'checkpoints', 'AOM3A1B_orangemixs.safetensors');
    const loraPath = opts.loraPath ? (path.isAbsolute(opts.loraPath) ? opts.loraPath : path.join(projectRoot, opts.loraPath)) : path.join(projectRoot, 'models', 'lora', 'pixel_f2.safetensors');
    const loraScale = opts.loraScale !== undefined ? opts.loraScale : 0.65;
    const steps = opts.steps || 14;
    const size = opts.size || 64;
    const removeBg = opts.removeBg ?? true;
    const strength = opts.strength !== undefined ? opts.strength : 0.38;
    const onProgress = opts.onProgress;

    const timestamp = Date.now();
    const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `hybrid_anim_${timestamp}`);

    const args = [
      '-u',
      pythonScript,
      '--refine_meta', opts.metaPath,
      '--strength', `${strength}`,
      '--checkpoint', checkpoint,
      '--lora', loraPath,
      '--prompt', basePrompt,
      '--steps', `${steps}`,
      '--lora_scale', `${loraScale}`,
      '--size', `${size}`,
      '--output_prefix', outputPrefix,
      '--action', action
    ];

    if (removeBg) {
      args.push('--remove_bg');
    }
    if (opts.seed !== undefined && opts.seed > 0) {
      args.push('--seed', `${opts.seed}`);
    }

    console.log(`[Hybrid AI] Dang chay tien trinh khau lien & ve bu: ${pythonExe} ${args.join(' ')}`);

    onProgress?.({
      stage: 'init',
      step: 0,
      totalSteps: 100,
      percent: 10,
      elapsed: 0,
      eta: 0,
      message: `Đang nạp Model AI để khâu liền vết nứt pixel...`
    });

    const child = spawn(pythonExe, args, { cwd: projectRoot });

    let stdoutData = '';
    let stderrData = '';
    let metaPathResult = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('AI_FRAME_PROGRESS:')) {
        const parts = trimmed.split(':');
        if (parts.length >= 4) {
          const frameIdx = parseInt(parts[1], 10);
          const totalFrames = parseInt(parts[2], 10);
          const pct = Math.round((frameIdx / totalFrames) * 90);
          onProgress?.({
            stage: 'refining',
            step: frameIdx,
            totalSteps: totalFrames,
            percent: pct,
            message: `AI đã khâu liền và hoàn thiện khung hình ${frameIdx}/${totalFrames}`
          });
        }
      } else if (trimmed.startsWith('AI_STAGE:REFINE_FRAME:')) {
        const msg = trimmed.replace('AI_STAGE:REFINE_FRAME:', '').trim();
        onProgress?.({
          stage: 'refining',
          message: msg
        });
      } else if (trimmed.startsWith('AI_ANIM_RESULT:')) {
        metaPathResult = trimmed.replace('AI_ANIM_RESULT:', '').trim();
      }
    };

    let stdoutBuffer = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutData += text;
      stdoutBuffer += text;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split(/[\r\n]+/);
      stderrBuffer = lines.pop() || '';
      for (const l of lines) handleLine(l);
    });

    child.on('error', (err) => {
      console.error('[Hybrid AI] Loi spawn tien trinh Python:', err);
      reject(err);
    });

    child.on('close', (code) => {
      if (stdoutBuffer) handleLine(stdoutBuffer);
      if (stderrBuffer) handleLine(stderrBuffer);

      if (code !== 0) {
        console.error(`[Hybrid AI] Tien trinh thoat voi ma loi ${code}:`, stderrData || stdoutData);
        return reject(new Error(stderrData || stdoutData || `Tiến trình Python thoát với mã lỗi ${code}`));
      }

      const metaPath = metaPathResult || `${outputPrefix}_anim_meta.json`;
      if (!fs.existsSync(metaPath)) {
        return reject(new Error(`Không tìm thấy file metadata hoạt ảnh tại: ${metaPath}`));
      }

      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        const frameFiles: string[] = meta.frameFiles || [];

        const frames: AnimationFrameResult[] = frameFiles.map((fPath, idx) => {
          const loaded = loadPngToPixels(fPath);
          return {
            frameIndex: idx,
            width: loaded.width,
            height: loaded.height,
            pixels: loaded.pixels,
            filename: path.basename(fPath),
            imagePath: fPath
          };
        });

        onProgress?.({
          stage: 'completed',
          percent: 100,
          message: `Hoàn tất khâu liền ${frames.length} frames hoạt cảnh!`
        });

        resolve({
          frameCount: frames.length,
          action,
          frames,
          metaPath
        });
      } catch (err: any) {
        reject(new Error(`Lỗi đọc dữ liệu frames hoạt cảnh: ${err.message}`));
      }
    });
  });
}


// apps/server/src/server.ts
// WebSocket Bridge va Local Hub Service tai cong 3055

import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { StateStore } from './state-store';
import { McpDrawPayload, CanvasProject } from '@pixel-draw/shared-types';
import { loadPngToPixels, generatePixelArt, generateSpriteAnimation, refineAnimationWithAi, getProjectRoot } from './ai-helper';
import { generateTemplateAnimation } from './template-animator';
import { expandPromptWithGemini } from './gemini-helper';
import { GalleryManager } from './gallery-manager';
import { ProjectAssetManager } from './asset-manager';

const PORT = 3055;
const stateStore = new StateStore();
const galleryManager = new GalleryManager();
const projectAssetManager = new ProjectAssetManager();
const connectedClients = new Set<WebSocket>();

// Giao dien va bo nho dem luu ket qua sinh anh AI gan nhat
interface LastAiResult {
  id: string;
  type: 'character' | 'animation';
  status: 'processing' | 'completed' | 'error';
  timestamp: number;
  prompt?: string;
  outputPath?: string;
  width?: number;
  height?: number;
  pixels?: { x: number; y: number; color: string | null }[];
  pixelCount?: number;
  seed?: number;
  frames?: any[];
  error?: string;
}

let lastAiResult: LastAiResult | null = null;

// 1. Tao HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connectedClients: connectedClients.size,
      project: stateStore.getProject()
    }));
    return;
  }

  // API Lay ket qua sinh anh AI gan nhat (ho tro phuc hoi khi fetch bi ngat socket)
  if (url.pathname === '/api/ai/last-result' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      result: lastAiResult
    }));
    return;
  }

  // API Nhan lenh ve tu MCP Client qua HTTP POST
  if (url.pathname === '/api/draw' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload: McpDrawPayload = JSON.parse(body);

        // Cap nhat vao StateStore
        if (payload.type === 'DRAW_PIXELS' && payload.pixels) {
          stateStore.applyPixels(payload.pixels, payload.layerId, payload.frameIndex);
        } else if (payload.type === 'DRAW_MATRIX' && payload.matrix && payload.paletteMap) {
          stateStore.applyMatrix(
            payload.matrix,
            payload.paletteMap,
            payload.offsetX,
            payload.offsetY,
            payload.layerId,
            payload.frameIndex
          );
        } else if (payload.type === 'ADD_FRAME') {
          stateStore.addFrame(payload.clipName);
        } else if ((payload as any).type === 'PROJECT_SYNC' && (payload as any).project) {
          stateStore.setProject((payload as any).project);
        }

        // Phat song cho tat ca cac client Studio dang mo (neu khong phai PROJECT_SYNC)
        if ((payload as any).type !== 'PROJECT_SYNC') {
          broadcastToStudio(payload);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, project: stateStore.getProject() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Xuat SpriteSheet
  if (url.pathname === '/api/export' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { outputPath, scale, project: clientProject } = JSON.parse(body);
        if (clientProject) {
          stateStore.setProject(clientProject);
        }
        const result = await stateStore.exportSpriteSheet(outputPath, scale || 1);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Nap anh PNG co san (vi du anh pixel LoRA da sinh) vao Canvas
  if (url.pathname === '/api/ai/load' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const imagePath = payload.imagePath || 'sample_pixel_64x64.png';
        const { width, height, pixels } = loadPngToPixels(imagePath);

        // Khoi tao Canvas voi kich thuoc dung bang kich thuoc anh
        stateStore.createCanvas(width, height, 'PixelPortrait');
        stateStore.applyPixels(pixels);

        // Dong bo toan bo Studio qua WebSocket
        const syncPayload = {
          type: 'PROJECT_SYNC',
          project: stateStore.getProject()
        };
        broadcastToStudio(syncPayload as any);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          width,
          height,
          pixelCount: pixels.length,
          project: stateStore.getProject()
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Tro ly Gemini chuyen doi mo ta tu nhien thanh Danbooru tags
  if (url.pathname === '/api/ai/gemini-prompt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const { description, model, apiKey } = payload;
        if (!description) {
          throw new Error('Vui lòng cung cấp nội dung mô tả');
        }

        const result = await expandPromptWithGemini(description, model || 'pixel_portrait_lora', apiKey);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          prompt: result.prompt,
          tags: result.tags
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: err.message || 'Không thể tạo tags với Gemini'
        }));
      }
    });
    return;
  }

  // API Yeu cau mo hinh LoRA sinh anh moi va tu dong nap vao Canvas
  if (url.pathname === '/api/ai/generate' && req.method === 'POST') {
    // Vo hieu hoa timeout cho socket de xu ly cac tac vu AI ton thoi gian tren CPU
    req.setTimeout(0);
    res.setTimeout(0);
    if (req.socket) {
      req.socket.setTimeout(0);
      req.socket.setKeepAlive(true, 10000);
      req.socket.setNoDelay(true);
    }

    const genId = 'char_' + Date.now();
    lastAiResult = {
      id: genId,
      type: 'character',
      status: 'processing',
      timestamp: Date.now()
    };

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const {
          prompt,
          checkpoint,
          loraPath,
          loraScale,
          steps,
          size,
          resample,
          removeBg,
          mode,
          seed
        } = payload;

        if (!prompt) {
          throw new Error('Vui long cung cap cau lenh prompt');
        }

        const { outputPath, seed: resolvedSeed } = await generatePixelArt({
          prompt,
          checkpoint: checkpoint || 'models/checkpoints/AOM3A1B_orangemixs.safetensors',
          loraPath: loraPath || 'models/lora/pixel_portrait_lora.safetensors',
          loraScale: typeof loraScale === 'number' ? loraScale : 0.6,
          steps: steps || 16,
          size: size || 64,
          resample: resample || 'NEAREST',
          removeBg: !!removeBg,
          seed: seed !== undefined ? parseInt(seed, 10) : undefined,
          onProgress: (progress) => {
            // Phat song tien trinh thoi gian thuc ve cac tab Studio dang mo
            broadcastToStudio({
              type: 'AI_PROGRESS' as any,
              ...progress
            } as any);
          }
        });

        const { width, height, pixels } = loadPngToPixels(outputPath);

        // Che do them vao Layer moi hoac tao Canvas moi
        if (mode === 'preview_only') {
          // Che do chi xem truoc (khong sua Canvas chinh)
        } else if (mode === 'replace_canvas') {
          stateStore.createCanvas(width, height, `AI Pixel (${size || 64}x${size || 64})`);
          stateStore.applyPixels(pixels);
        } else if (mode === 'new_layer_keep') {
          // Them layer moi va giu nguyen hien thi ca layer cu
          stateStore.addAiLayer(pixels, width, height, `AI Pixel (${size || 64}x${size || 64})`, false);
        } else {
          // Mac dinh (new_layer): Them layer moi va tu dong an cac layer cu de khong bi chong hinh len nhau
          stateStore.addAiLayer(pixels, width, height, `AI Pixel (${size || 64}x${size || 64})`, true);
        }

        // Tu dong luu vao kho anh Gallery neu khong phai preview_only
        if (mode !== 'preview_only') {
          try {
            galleryManager.saveAiGeneratedItem(outputPath, prompt, size || 64);
          } catch (e) {
            console.error('[Gallery] Loi khi tu dong luu anh AI vao kho:', e);
          }

          const syncPayload = {
            type: 'PROJECT_SYNC',
            project: stateStore.getProject()
          };
          broadcastToStudio(syncPayload as any);
        }

        // Luu lai ket qua thanh cong de client co the truy van khuc phuc
        lastAiResult = {
          id: genId,
          type: 'character',
          status: 'completed',
          timestamp: Date.now(),
          prompt,
          outputPath,
          width,
          height,
          pixels,
          pixelCount: pixels.length,
          seed: resolvedSeed
        };

        // Phat song su kien hoan tat qua WebSocket
        broadcastToStudio({
          type: 'AI_COMPLETED' as any,
          result: lastAiResult
        } as any);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          outputPath,
          width,
          height,
          pixels,
          pixelCount: pixels.length,
          seed: resolvedSeed,
          project: stateStore.getProject()
        }));
      } catch (err: any) {
        lastAiResult = {
          id: genId,
          type: 'character',
          status: 'error',
          error: err.message,
          timestamp: Date.now()
        };
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Sinh chuoi hoat anh SpriteSheet dong bo va tra ve cac Frame con
  if (url.pathname === '/api/ai/generate-animation' && req.method === 'POST') {
    // Vo hieu hoa timeout cho socket de xu ly tien trinh AI lau dai
    req.setTimeout(0);
    res.setTimeout(0);
    if (req.socket) {
      req.socket.setTimeout(0);
      req.socket.setKeepAlive(true, 10000);
      req.socket.setNoDelay(true);
    }

    const animGenId = 'anim_' + Date.now();
    lastAiResult = {
      id: animGenId,
      type: 'animation',
      status: 'processing',
      timestamp: Date.now()
    };

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const {
          engine = 'template',
          basePrompt,
          action = 'walk',
          frameCount = 4,
          seed,
          checkpoint,
          loraPath,
          loraScale,
          steps,
          size = 64,
          removeBg,
          basePixels,
          skeletonRig,
          strength = 0.38,
          slashVfxType = 'cyan'
        } = payload;

        // 1. Che do 1: Khung xuong bien doi diem anh (Template Engine - Nhanh tuc thi <10ms va on dinh 100%)
        if (engine === 'template') {
          const timestamp = Date.now();
          const projectRoot = getProjectRoot();
          const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `template_anim_${timestamp}`);

          const animResult = generateTemplateAnimation({
            action,
            frameCount: parseInt(frameCount, 10) || 4,
            basePixels: Array.isArray(basePixels) ? basePixels : [],
            width: parseInt(size, 10) || 64,
            height: parseInt(size, 10) || 64,
            outputPrefix,
            skeletonRig,
            slashVfxType
          });

          // Thong bao hoan tat qua WebSocket
          broadcastToStudio({
            type: 'AI_PROGRESS',
            stage: 'completed',
            percent: 100,
            message: `Hoàn tất tạo ${animResult.frameCount} frames hoạt ảnh bằng Khung Xương Pixel!`
          } as any);

          lastAiResult = {
            id: animGenId,
            type: 'animation',
            status: 'completed',
            timestamp: Date.now(),
            frames: animResult.frames
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            engine: 'template',
            action: animResult.action,
            frameCount: animResult.frameCount,
            frames: animResult.frames,
            skeletonRig: animResult.skeletonRig
          }));
          return;
        }

        // 2. Che do 2: Hybrid AI Refiner (Khung xuong dinh hinh tu the tho + Model AI khau lien va ve bu)
        if (engine === 'hybrid') {
          const timestamp = Date.now();
          const projectRoot = getProjectRoot();
          const outputPrefix = path.join(projectRoot, 'storage', 'outputs', `hybrid_anim_${timestamp}`);

          // Buoc A: Dinh hinh tu the tho bang khung xuong OpenPose
          broadcastToStudio({
            type: 'AI_PROGRESS',
            stage: 'rigging',
            percent: 15,
            message: `Bước 1/2: Đang dùng khung xương dựng ${frameCount} frames tư thế thô cho ${action}...`
          } as any);

          const roughResult = generateTemplateAnimation({
            action,
            frameCount: parseInt(frameCount, 10) || 4,
            basePixels: Array.isArray(basePixels) ? basePixels : [],
            width: parseInt(size, 10) || 64,
            height: parseInt(size, 10) || 64,
            outputPrefix: `${outputPrefix}_rough`,
            skeletonRig,
            slashVfxType
          });

          // Buoc B: Model AI thuc hien khau lien va ve bu cac diem rach
          broadcastToStudio({
            type: 'AI_PROGRESS',
            stage: 'refining',
            percent: 30,
            message: `Bước 2/2: Đang nạp Model AI để khâu liền vết nứt pixel và nếp gấp trang phục...`
          } as any);

          const onProgress = (progress: any) => {
            broadcastToStudio({
              type: 'AI_PROGRESS',
              ...progress
            } as any);
          };

          const refinedResult = await refineAnimationWithAi({
            metaPath: roughResult.metaPath,
            basePrompt: basePrompt || 'pixel art hero',
            action,
            strength: typeof strength === 'number' ? strength : parseFloat(strength) || 0.38,
            seed: seed ? parseInt(seed, 10) : undefined,
            checkpoint,
            loraPath,
            loraScale: loraScale !== undefined ? parseFloat(loraScale) : 0.65,
            steps: 14,
            size: parseInt(size, 10) || 64,
            removeBg: removeBg ?? true,
            onProgress
          });

          lastAiResult = {
            id: animGenId,
            type: 'animation',
            status: 'completed',
            timestamp: Date.now(),
            frames: refinedResult.frames
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            engine: 'hybrid',
            action: refinedResult.action,
            frameCount: refinedResult.frameCount,
            frames: refinedResult.frames,
            skeletonRig: roughResult.skeletonRig
          }));
          return;
        }

        // 3. Che do 3: 2D Pixel Toolkit (AI SpriteSheet Reference-guided)
        const onProgress = (progress: any) => {
          broadcastToStudio({
            type: 'AI_PROGRESS',
            ...progress
          } as any);
        };

        const animResult = await generateSpriteAnimation({
          basePrompt,
          action: action || 'walk',
          frameCount: frameCount || 4,
          seed: seed ? parseInt(seed, 10) : undefined,
          checkpoint,
          loraPath,
          loraScale: loraScale !== undefined ? parseFloat(loraScale) : undefined,
          steps: steps ? parseInt(steps, 10) : undefined,
          size: size ? parseInt(size, 10) : 64,
          removeBg: removeBg ?? true,
          basePixels: Array.isArray(basePixels) && basePixels.length > 0 ? basePixels : undefined,
          strength: typeof strength === 'number' ? strength : (strength ? parseFloat(strength) : 0.62),
          onProgress
        });

        lastAiResult = {
          id: animGenId,
          type: 'animation',
          status: 'completed',
          timestamp: Date.now(),
          frames: animResult.frames
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          engine: 'ai',
          action: animResult.action,
          frameCount: animResult.frameCount,
          frames: animResult.frames
        }));
      } catch (err: any) {
        lastAiResult = {
          id: animGenId,
          type: 'animation',
          status: 'error',
          error: err.message,
          timestamp: Date.now()
        };
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Thay doi kich thuoc Canvas va can le
  if (url.pathname === '/api/canvas/resize' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { width, height, anchor } = JSON.parse(body);
        const w = parseInt(width, 10);
        const h = parseInt(height, 10);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0 || w > 512 || h > 512) {
          throw new Error('Kich thuoc Canvas phai la so nguyen tu 1 den 512');
        }

        stateStore.resizeCanvas(w, h, anchor || 'center');

        const syncPayload = {
          type: 'PROJECT_SYNC',
          project: stateStore.getProject()
        };
        broadcastToStudio(syncPayload as any);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, project: stateStore.getProject() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Lay danh sach toan bo anh trong kho
  if (url.pathname === '/api/gallery' && req.method === 'GET') {
    const items = galleryManager.getAllItems();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items }));
    return;
  }

  // API Luu tac pham Canvas hien tai vao kho
  if (url.pathname === '/api/gallery/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { name, project: clientProject } = body ? JSON.parse(body) : {};
        if (clientProject) {
          stateStore.setProject(clientProject);
        }
        const item = await galleryManager.saveCanvasItem(stateStore.getProject(), name);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Nap mot anh hoac du an nguyen ven tu kho len Canvas
  if (url.pathname === '/api/gallery/load' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { filename, id } = JSON.parse(body);
        if (!filename && !id) throw new Error('Vui long cung cap ten hoac id can nap');

        // Tim thong tin tac pham trong kho
        const items = galleryManager.getAllItems();
        const item = items.find(it => (id && it.id === id) || (filename && it.filename === filename));

        let loadedProject: CanvasProject | null = null;
        if (item) {
          loadedProject = galleryManager.getProjectData(item);
        }

        if (loadedProject) {
          // Truong hop tac pham co luu du lieu du an: Khoi phuc 100% toan bo frames, layers va clips
          stateStore.setProject(loadedProject);
        } else {
          // Truong hop la anh AI hoac anh cu chi co dinh dang PNG
          const targetFilename = item ? item.filename : filename;
          const filePath = galleryManager.getItemFilePath(targetFilename);
          const { width, height, pixels } = loadPngToPixels(filePath);

          stateStore.createCanvas(width, height, path.parse(targetFilename).name);
          stateStore.applyPixels(pixels);
        }

        const currentProject = stateStore.getProject();
        const syncPayload = {
          type: 'PROJECT_SYNC',
          project: currentProject
        };
        broadcastToStudio(syncPayload as any);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          isFullProject: !!loadedProject,
          frameCount: currentProject.frames?.length || 1,
          layerCount: currentProject.frames?.[0]?.layers?.length || 1,
          width: currentProject.width,
          height: currentProject.height,
          project: currentProject
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Xoa mot anh khoi kho
  if (url.pathname === '/api/gallery/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) throw new Error('Vui long truyen id anh can xoa');
        const success = galleryManager.deleteItem(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Lay toan bo cay thu muc va tai nguyen du an (Project Asset Tree)
  if (url.pathname === '/api/project-assets/tree' && req.method === 'GET') {
    try {
      const tree = projectAssetManager.getAssetTree();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tree }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API Tao thu muc moi trong cay tai nguyen
  if (url.pathname === '/api/project-assets/folder' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, parentPath } = JSON.parse(body || '{}');
        if (!name) throw new Error('Vui lòng nhập tên thư mục');
        const item = projectAssetManager.createFolder(name, parentPath || 'Assets');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item, tree: projectAssetManager.getAssetTree() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Luu sprite hien tai vao thu muc chi dinh
  if (url.pathname === '/api/project-assets/save-sprite' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { name, folderPath, data } = JSON.parse(body || '{}');
        if (!folderPath || !data) throw new Error('Dữ liệu lưu sprite không hợp lệ');
        const item = await projectAssetManager.saveSprite({
          name: name || `Sprite_${Date.now()}`,
          folderPath,
          data
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item, tree: projectAssetManager.getAssetTree() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Xoa mot thu muc hoac sprite
  if ((url.pathname === '/api/project-assets/delete' && req.method === 'POST') ||
      (url.pathname === '/api/project-assets/item' && req.method === 'DELETE')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const targetPath = parsed.path || url.searchParams.get('path');
        if (!targetPath) throw new Error('Vui lòng chỉ định đường dẫn cần xóa');
        if (targetPath === 'Assets') throw new Error('Không thể xóa thư mục gốc Assets');
        const success = projectAssetManager.deleteItem(targetPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, tree: projectAssetManager.getAssetTree() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Doi ten mot thu muc hoac sprite
  if (url.pathname === '/api/project-assets/rename' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { path: targetPath, newName } = JSON.parse(body || '{}');
        if (!targetPath || !newName) throw new Error('Thông tin đổi tên không đầy đủ');
        if (targetPath === 'Assets') throw new Error('Không thể đổi tên thư mục gốc Assets');
        const success = projectAssetManager.renameItem(targetPath, newName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, tree: projectAssetManager.getAssetTree() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Di chuyen item giua cac thu muc (ho tro Drag & Drop)
  if (url.pathname === '/api/project-assets/move' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sourcePath, targetFolderPath } = JSON.parse(body || '{}');
        if (!sourcePath || !targetFolderPath) throw new Error('Thông tin di chuyển không đầy đủ');
        const success = projectAssetManager.moveItem(sourcePath, targetFolderPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, tree: projectAssetManager.getAssetTree() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Luu nhan vat cot loi (Character Core Package)
  if (url.pathname === '/api/characters/save-core' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { coreData, base64Png } = JSON.parse(body || '{}');
        if (!coreData || !coreData.name) {
          throw new Error('Dữ liệu nhân vật không hợp lệ hoặc thiếu tên');
        }
        const result = projectAssetManager.saveCharacterCore(coreData, base64Png);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: result,
          tree: projectAssetManager.getAssetTree()
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Lay danh sach toan bo nhan vat da luu
  if (url.pathname === '/api/characters/list' && req.method === 'GET') {
    try {
      const characters = projectAssetManager.listCharacterCores();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, characters }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API Lay chi tiet 1 nhan vat theo id hoac slug (qua query param hoac URL path)
  if ((url.pathname === '/api/characters/detail' && req.method === 'GET') ||
      (url.pathname.startsWith('/api/characters/') && req.method === 'GET' && !url.pathname.includes('/list'))) {
    try {
      const idOrSlug = url.searchParams.get('id') || url.searchParams.get('slug') || url.pathname.replace('/api/characters/', '').trim();
      if (!idOrSlug) {
        throw new Error('Vui lòng chỉ định ID hoặc slug nhân vật');
      }
      const character = projectAssetManager.getCharacterCore(idOrSlug);
      if (!character) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Không tìm thấy nhân vật' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, character }));
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API Luu chuoi frames dong tac moi vao thu muc con cua nhan vat
  if ((url.pathname === '/api/characters/save-action' || url.pathname.match(/^\/api\/characters\/[^/]+\/save-action$/)) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const match = url.pathname.match(/^\/api\/characters\/([^/]+)\/save-action$/);
        const targetId = match ? match[1] : (parsed.id || parsed.slug);
        const { action, frames } = parsed;

        if (!targetId || !action || !Array.isArray(frames)) {
          throw new Error('Dữ liệu lưu động tác không đầy đủ (cần ID, tên động tác và danh sách frames)');
        }

        const result = projectAssetManager.saveCharacterAction(targetId, action, frames);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ...result,
          tree: projectAssetManager.getAssetTree()
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Cap nhat pixel goc cua nhan vat khi nguoi dung ve lai tren Canvas
  if ((url.pathname === '/api/characters/update-core-pixels' || url.pathname.match(/^\/api\/characters\/[^/]+\/update-core-pixels$/)) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const match = url.pathname.match(/^\/api\/characters\/([^/]+)\/update-core-pixels$/);
        const targetId = match ? match[1] : (parsed.id || parsed.slug);
        const { pixels, width, height, base64Png } = parsed;

        if (!targetId || !Array.isArray(pixels)) {
          throw new Error('Dữ liệu cập nhật điểm ảnh không đầy đủ');
        }

        const success = projectAssetManager.updateCharacterCorePixels(targetId, pixels, width || 64, height || 64, base64Png);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success,
          tree: projectAssetManager.getAssetTree()
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// 2. Tao WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  connectedClients.add(ws);

  // Gui trang thai canvas hien tai ngay khi client ket noi
  ws.send(JSON.stringify({
    type: 'PROJECT_SYNC',
    project: stateStore.getProject()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'PROJECT_SYNC' && data.project) {
        // Cap nhat lai du an tu studio
        stateStore.setProject(data.project);
      }
    } catch (err) {
      console.error('Loi phan tich WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

// Phat song du lieu toi toan bo Studio
export function broadcastToStudio(payload: McpDrawPayload): void {
  const json = JSON.stringify(payload);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// Vo hieu hoa timeout de dam bao ket noi giua Studio va Server khong bi ngat khi sinh AI tren CPU
server.timeout = 0;
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 600000;

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pixel Draw WebSocket Bridge dang lang nghe tai http://127.0.0.1:${PORT}`);
});


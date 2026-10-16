// apps/server/src/server.ts
// WebSocket Bridge va Local Hub Service tai cong 3055

import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { StateStore } from './state-store';
import { McpDrawPayload } from '@pixel-draw/shared-types';
import { loadPngToPixels, generateStardewPortrait } from './ai-helper';
import { GalleryManager } from './gallery-manager';

const PORT = 3055;
const stateStore = new StateStore();
const galleryManager = new GalleryManager();
const connectedClients = new Set<WebSocket>();

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
        }

        // Phat song cho tat ca cac client Studio dang mo
        broadcastToStudio(payload);

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
        const { outputPath, scale } = JSON.parse(body);
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
        const imagePath = payload.imagePath || 'th_stardew_test_pixel_64x64.png';
        const { width, height, pixels } = loadPngToPixels(imagePath);

        // Khoi tao Canvas voi kich thuoc dung bang kich thuoc anh
        stateStore.createCanvas(width, height, 'StardewPortrait');
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

  // API Yeu cau mo hinh LoRA sinh anh moi va tu dong nap vao Canvas
  if (url.pathname === '/api/ai/generate' && req.method === 'POST') {
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
          mode
        } = payload;

        if (!prompt) {
          throw new Error('Vui long cung cap cau lenh prompt');
        }

        const outputPath = await generateStardewPortrait({
          prompt,
          checkpoint: checkpoint || 'models/checkpoints/AOM3A1B_orangemixs.safetensors',
          loraPath: loraPath || 'models/lora/th_stardew_portrait_lora.safetensors',
          loraScale: typeof loraScale === 'number' ? loraScale : 0.6,
          steps: steps || 16,
          size: size || 64,
          resample: resample || 'NEAREST',
          removeBg: !!removeBg,
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
        if (mode === 'replace_canvas') {
          stateStore.createCanvas(width, height, `AI Stardew (${size || 64}x${size || 64})`);
          stateStore.applyPixels(pixels);
        } else if (mode === 'new_layer_keep') {
          // Them layer moi va giu nguyen hien thi ca layer cu
          stateStore.addAiLayer(pixels, width, height, `AI Stardew (${size || 64}x${size || 64})`, false);
        } else {
          // Mac dinh (new_layer): Them layer moi va tu dong an cac layer cu de khong bi chong hinh len nhau
          stateStore.addAiLayer(pixels, width, height, `AI Stardew (${size || 64}x${size || 64})`, true);
        }

        // Tu dong luu vao kho anh Gallery
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          outputPath,
          width,
          height,
          pixelCount: pixels.length,
          project: stateStore.getProject()
        }));
      } catch (err: any) {
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
        const { name } = body ? JSON.parse(body) : {};
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

  // API Nap mot anh tu kho len Canvas
  if (url.pathname === '/api/gallery/load' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { filename } = JSON.parse(body);
        if (!filename) throw new Error('Vui long cung cap ten anh can nap');

        const filePath = galleryManager.getItemFilePath(filename);
        const { width, height, pixels } = loadPngToPixels(filePath);

        stateStore.createCanvas(width, height, path.parse(filename).name);
        stateStore.applyPixels(pixels);

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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pixel Draw WebSocket Bridge dang lang nghe tai http://127.0.0.1:${PORT}`);
});

// apps/server/src/server.ts
// WebSocket Bridge va Local Hub Service tai cong 3055

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { StateStore } from './state-store';
import { McpDrawPayload } from '@pixel-draw/shared-types';

const PORT = 3055;
const stateStore = new StateStore();
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

// apps/mcp/src/bridge-client.ts
// Client ket noi tu MCP Server sang Local Server (Port 3055)

import http from 'http';
import { McpDrawPayload } from '@pixel-draw/shared-types';

export class BridgeClient {
  private port = 3055;
  private host = '127.0.0.1';

  // Gui payload lenh ve toi Local Server qua HTTP POST
  async sendDrawCommand(payload: McpDrawPayload): Promise<any> {
    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      const req = http.request(
        {
          hostname: this.host,
          port: this.port,
          path: '/api/draw',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          timeout: 1500
        },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ success: true });
            }
          });
        }
      );

      req.on('error', () => {
        // Neu server bridge chua mo (headless), van tiep tuc khong lam gian doan AI
        resolve({ success: true, offline: true });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: true, timeout: true });
      });

      req.write(data);
      req.end();
    });
  }

  // Yeu cau xuat SpriteSheet
  async sendExportCommand(outputPath: string, scale = 1): Promise<any> {
    return new Promise((resolve) => {
      const data = JSON.stringify({ outputPath, scale });
      const req = http.request(
        {
          hostname: this.host,
          port: this.port,
          path: '/api/export',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          timeout: 5000
        },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ success: true });
            }
          });
        }
      );

      req.on('error', () => {
        resolve({ success: false, error: 'Khong the ket noi toi Local Server de xuat file' });
      });

      req.write(data);
      req.end();
    });
  }
}

// apps/mcp/src/tools-handler.ts
// Dinh nghia danh muc 10 cong cu MCP va xu ly goi ham tu AI

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BridgeClient } from './bridge-client';
import { McpDrawPayload, PixelPoint } from '@pixel-draw/shared-types';

const bridge = new BridgeClient();

export const MCP_TOOLS_DEFINITIONS: Tool[] = [
  {
    name: 'create_canvas',
    description: 'Khoi tao khung ve pixel moi voi kich thuoc va ten chi dinh',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Chieu rong canvas (16, 24, 32, 48, 64)' },
        height: { type: 'number', description: 'Chieu cao canvas (16, 24, 32, 48, 64)' },
        name: { type: 'string', description: 'Ten tac pham hoac ten sprite nhan vat' }
      },
      required: ['width', 'height']
    }
  },
  {
    name: 'get_canvas_state',
    description: 'Lay thong tin trang thai hien tai cua canvas, danh sach layers, clips va kich thuoc',
    inputSchema: {
      type: 'object',
      properties: {
        include_matrix: { type: 'boolean', description: 'Co tra ve ma tran diem anh hay khong' }
      }
    }
  },
  {
    name: 'draw_matrix',
    description: 'Ve nhanh mot ma tran diem anh bang chuoi ky tu va bang ma mau hex',
    inputSchema: {
      type: 'object',
      properties: {
        matrix: {
          type: 'array',
          items: { type: 'string' },
          description: 'Mang cac chuoi bieu dien tung hang pixel'
        },
        paletteMap: {
          type: 'object',
          description: 'Anh xa ky tu sang ma mau hex (vi du: {"X": "#000000", "R": "#ff0000", ".": null})'
        },
        offsetX: { type: 'number', description: 'Do lech toa do X (mac dinh 0)' },
        offsetY: { type: 'number', description: 'Do lech toa do Y (mac dinh 0)' },
        layerId: { type: 'string', description: 'ID layer muon ve len' },
        frameIndex: { type: 'number', description: 'Chi so frame muon ve' }
      },
      required: ['matrix', 'paletteMap']
    }
  },
  {
    name: 'draw_pixels',
    description: 'Ve danh sach cac pixel le vao canvas',
    inputSchema: {
      type: 'object',
      properties: {
        pixels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              color: { type: ['string', 'null'] }
            },
            required: ['x', 'y', 'color']
          },
          description: 'Danh sach cac diem pixel can ve'
        },
        layerId: { type: 'string' },
        frameIndex: { type: 'number' }
      },
      required: ['pixels']
    }
  },
  {
    name: 'draw_shape',
    description: 'Ve cac hinh hoc co ban nhu duong thang, hinh chu nhat, hinh tron',
    inputSchema: {
      type: 'object',
      properties: {
        shape_type: { type: 'string', enum: ['line', 'rectangle', 'circle'] },
        x0: { type: 'number' },
        y0: { type: 'number' },
        x1: { type: 'number' },
        y1: { type: 'number' },
        radius: { type: 'number' },
        color: { type: 'string' }
      },
      required: ['shape_type', 'color']
    }
  },
  {
    name: 'flood_fill',
    description: 'Do mau lien thong cho mot vung canvas (thung son)',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        color: { type: 'string' }
      },
      required: ['x', 'y', 'color']
    }
  },
  {
    name: 'create_animation_clip',
    description: 'Tao mot nhan hoat anh moi (vi du: idle, walk, attack, jump)',
    inputSchema: {
      type: 'object',
      properties: {
        tag_name: { type: 'string', description: 'Ten dong tac hoat anh' },
        frame_count: { type: 'number', description: 'So luong khung hinh cho dong tac nay' },
        fps: { type: 'number', description: 'Toc do khung hinh (mac dinh 10 FPS)' }
      },
      required: ['tag_name', 'frame_count']
    }
  },
  {
    name: 'draw_animation_frame',
    description: 'Ve mot khung hinh cu the trong clip hoat anh bang ma tran pixel',
    inputSchema: {
      type: 'object',
      properties: {
        tag_name: { type: 'string' },
        frame_index: { type: 'number' },
        matrix: { type: 'array', items: { type: 'string' } },
        paletteMap: { type: 'object' },
        duration_ms: { type: 'number' }
      },
      required: ['tag_name', 'frame_index', 'matrix', 'paletteMap']
    }
  },
  {
    name: 'copy_frame_with_offset',
    description: 'Nhan ban mot khung hinh sang khung hinh moi kem theo do lech toa do (tao chuyen dong buoc chan, nhip tho)',
    inputSchema: {
      type: 'object',
      properties: {
        source_frame: { type: 'number' },
        target_frame: { type: 'number' },
        offset_x: { type: 'number' },
        offset_y: { type: 'number' }
      },
      required: ['source_frame', 'target_frame', 'offset_x', 'offset_y']
    }
  },
  {
    name: 'export_spritesheet',
    description: 'Xuat toan bo khung hinh hoat anh thanh tep anh PNG SpriteSheet va tep JSON metadata vao thu muc du an',
    inputSchema: {
      type: 'object',
      properties: {
        output_path: { type: 'string', description: 'Duong dan tuyet doi hoac tuong doi toi file anh dich (vi du: d:/game/gun-gun/assets/hero.png)' },
        scale: { type: 'number', description: 'He so phong to (1, 2, 4, 8, 16)' },
        export_json_meta: { type: 'boolean', description: 'Co xuat file JSON metadata kem theo khong' }
      },
      required: ['output_path']
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'create_canvas': {
        const payload: McpDrawPayload = {
          type: 'PROJECT_SYNC',
          scale: 1
        };
        await bridge.sendDrawCommand(payload);
        return {
          content: [{ type: 'text', text: `Da khoi tao canvas ${args.width}x${args.height} voi ten '${args.name || 'Sprite'}'` }]
        };
      }

      case 'draw_matrix': {
        const payload: McpDrawPayload = {
          type: 'DRAW_MATRIX',
          matrix: args.matrix,
          paletteMap: args.paletteMap,
          offsetX: args.offsetX || 0,
          offsetY: args.offsetY || 0,
          layerId: args.layerId,
          frameIndex: args.frameIndex
        };
        await bridge.sendDrawCommand(payload);
        return {
          content: [{ type: 'text', text: `Ve ma tran pixel thanh cong tai vi tri (${args.offsetX || 0}, ${args.offsetY || 0})` }]
        };
      }

      case 'draw_pixels': {
        const payload: McpDrawPayload = {
          type: 'DRAW_PIXELS',
          pixels: args.pixels,
          layerId: args.layerId,
          frameIndex: args.frameIndex
        };
        await bridge.sendDrawCommand(payload);
        return {
          content: [{ type: 'text', text: `Da ve ${args.pixels.length} diem pixel len canvas` }]
        };
      }

      case 'create_animation_clip': {
        const payload: McpDrawPayload = {
          type: 'ADD_FRAME',
          clipName: args.tag_name
        };
        await bridge.sendDrawCommand(payload);
        return {
          content: [{ type: 'text', text: `Da tao clip hoat anh '${args.tag_name}' gom ${args.frame_count} khung hinh` }]
        };
      }

      case 'draw_animation_frame': {
        const payload: McpDrawPayload = {
          type: 'DRAW_MATRIX',
          matrix: args.matrix,
          paletteMap: args.paletteMap,
          clipName: args.tag_name,
          frameIndex: args.frame_index
        };
        await bridge.sendDrawCommand(payload);
        return {
          content: [{ type: 'text', text: `Da cap nhat khung hinh #${args.frame_index} cua clip '${args.tag_name}'` }]
        };
      }

      case 'export_spritesheet': {
        const res = await bridge.sendExportCommand(args.output_path, args.scale || 1);
        if (res && res.success) {
          return {
            content: [{ type: 'text', text: `Xuat SpriteSheet thanh cong tai: ${args.output_path}` }]
          };
        }
        return {
          content: [{ type: 'text', text: `Xuat SpriteSheet hoan tat tai: ${args.output_path}` }]
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Da thuc thi lenh ${name} thanh cong` }]
        };
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Loi thuc thi cong cu ${name}: ${err.message}` }]
    };
  }
}

# Kế Hoạch Triển Khai: Pixel Art Studio & MCP Integration Engine

> **Dành cho Agent thực thi:** YÊU CẦU SUB-SKILL: Sử dụng superpowers:subagent-driven-development (khuyến nghị) hoặc superpowers:executing-plans để triển khai kế hoạch này theo từng tác vụ. Các bước sử dụng cú pháp ô kiểm (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Xây dựng hoàn chỉnh hệ sinh thái đồ họa pixel gồm Studio Web App (hỗ trợ Animation Clips, Layers, Palette), WebSocket Bridge Server, Stdio MCP Server cho AI và Custom Skill `pixel-artist` mô-đun hóa có thể tùy biến phong cách.

**Kiến trúc:** Monorepo tại `d:/pixel_draw` gồm 3 ứng dụng: `apps/studio` (Vite + TypeScript + Canvas 2D), `apps/server` (Node.js + ws + PNG Exporter), `apps/mcp` (Stdio MCP Server kết nối Server/Studio), và Custom Skill cài đặt tại `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist`.

**Công nghệ:** TypeScript, Vite, Node.js, WebSocket (`ws`), `@modelcontextprotocol/sdk`, Vitest, HTML5 Canvas 2D API.

**Tài liệu thiết kế:** [2026-10-14-pixel-art-studio-and-mcp-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-14-pixel-art-studio-and-mcp-design.md)

## Ràng Buộc Toàn Cục

- Ngôn ngữ giao tiếp và chú thích mã nguồn: 100% tiếng Việt.
- Không sử dụng bất kỳ biểu tượng icon hoặc emoji nào trong mã nguồn, văn bản và tài liệu.
- Không tự động commit git (tuân thủ quy định dự án của người dùng).
- Hạn chế tối đa việc dùng .sudo() trong các tác vụ liên quan đến Odoo hoặc hệ thống.
- Cấu hình hiển thị Canvas: `image-rendering: pixelated; crisp-edges`, thu phóng 100% đến 3200% giữ nguyên độ sắc cạnh của pixel.

## Tiêu Điểm Rà Soát (Review Focus)

1. Thuật toán Flood Fill (Thùng sơn) gặp vùng canvas kích thước lớn hoặc màu trùng lặp: Phải kiểm tra điều kiện biên và màu đích trùng màu hiện tại để tránh đệ quy vô hạn hoặc tràn ngăn xếp (Stack Overflow).
2. Xử lý độ trễ WebSocket khi AI gửi ma trận điểm ảnh lớn: Phải gom nhóm (batching) pixel updates để Canvas render mượt mà 60 FPS, không bị giật lag giao diện người dùng.
3. Đồng bộ hai chiều (Studio mở vs Studio đóng): Khi Studio đóng, Local Server phải tự xử lý lệnh vẽ vào bộ đệm RAM và xuất file PNG/JSON bình thường mà không báo lỗi mất kết nối client.
4. Tỷ lệ xuất ảnh (Scaling nearest neighbor): Khi xuất ảnh kích thước phóng to 2x, 4x, 8x, 16x, các pixel phải được nhân đôi chính xác tuyệt đối mà không bị làm nhòe hay nội suy màu (anti-aliasing).
5. Chu kỳ hoạt ảnh theo nhãn (Animation Clips / Tags): Khi đổi giữa các nhãn (ví dụ từ `idle` sang `walk`), khung phát preview phải tự động đặt lại frame đầu tiên của nhãn đó và điểm neo (Pivot Point) phải giữ nguyên tọa độ gốc.

---

### Tác Vụ 1: Khởi Tạo Dự Án Monorepo và Kiểu Dữ Liệu Dùng Chung

**Tệp:**
- Tạo mới: `package.json`
- Tạo mới: `tsconfig.base.json`
- Tạo mới: `packages/shared-types/src/index.ts`
- Tạo mới: `packages/shared-types/package.json`
- Tạo mới: `packages/shared-types/tsconfig.json`
- Kiểm thử: `packages/shared-types/tests/types.test.ts`

**Giao diện:**
- Cung cấp:
  - `PixelColor`: Chuỗi mã màu HEX (`#RRGGBB` hoặc `#RRGGBBAA`) hoặc null cho trong suốt.
  - `PixelPoint`: `{ x: number; y: number; color: PixelColor }`.
  - `LayerData`: `{ id: string; name: string; visible: boolean; locked: boolean; opacity: number; pixels: Map<string, PixelColor> }`.
  - `FrameData`: `{ id: string; durationMs: number; layers: LayerData[] }`.
  - `AnimationClip`: `{ id: string; name: string; startFrame: number; endFrame: number; fps: number; loop: boolean }`.
  - `CanvasProject`: `{ name: string; width: number; height: number; pivot: { x: number; y: number }; clips: AnimationClip[]; frames: FrameData[]; activeFrameIndex: number; activeLayerId: string }`.
  - `McpDrawPayload`: Định dạng thông điệp trao đổi giữa MCP, Server và Studio.

- [ ] **Bước 1: Viết bài kiểm thử cho các kiểu dữ liệu và hàm tiện ích chuyển đổi tọa độ**

```typescript
import { describe, it, expect } from 'vitest';
import { coordToKey, keyToCoord } from '../src/index';

describe('Toa do pixel key helper', () => {
  it('chuyen doi qua lai chinh xac giua toa do va key chuoi', () => {
    const key = coordToKey(12, 24);
    expect(key).toBe('12,24');
    const coord = keyToCoord(key);
    expect(coord).toEqual({ x: 12, y: 24 });
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**

Chạy: `npx vitest run packages/shared-types/tests/types.test.ts`
Kỳ vọng: Thất bại do chưa định nghĩa file nguồn.

- [ ] **Bước 3: Cấu hình `package.json` gốc, `tsconfig.base.json` và triển khai `packages/shared-types/src/index.ts`**

Định nghĩa toàn bộ các interface dữ liệu cốt lõi, hàm `coordToKey`, `keyToCoord`, hàm tạo dự án mặc định `createDefaultProject(width, height, name)`.

- [ ] **Bước 4: Chạy lại kiểm thử để xác nhận thành công**

Chạy: `npx vitest run packages/shared-types/tests/types.test.ts`
Kỳ vọng: Thành công 100%.

---

### Tác Vụ 2: Xây Dựng Core Canvas Engine và Bộ Đệm Pixel (apps/studio)

**Tệp:**
- Tạo mới: `apps/studio/package.json`
- Tạo mới: `apps/studio/tsconfig.json`
- Tạo mới: `apps/studio/vite.config.ts`
- Tạo mới: `apps/studio/src/core/pixel-buffer.ts`
- Tạo mới: `apps/studio/src/core/canvas-engine.ts`
- Tạo mới: `apps/studio/src/core/history-manager.ts`
- Kiểm thử: `apps/studio/tests/pixel-buffer.test.ts`
- Kiểm thử: `apps/studio/tests/history-manager.test.ts`

**Giao diện:**
- Nhận vào: `packages/shared-types`
- Cung cấp:
  - `PixelBuffer`: Quản lý mảng điểm ảnh 2D, các phương thức `getPixel(x, y)`, `setPixel(x, y, color)`, `clear()`, `toImageData()`, `fromMatrix(matrix, paletteMap)`.
  - `CanvasEngine`: Điều khiển việc vẽ các layer lên HTML5 Canvas, xử lý tỷ lệ thu phóng (100% - 3200%), tọa độ chuột trên canvas thực, vẽ lưới điểm ảnh pixel grid, vẽ điểm neo pivot.
  - `HistoryManager`: Quản lý ngăn xếp Undo/Redo với khả năng khôi phục trạng thái khung hình và các layer.

- [ ] **Bước 1: Viết kiểm thử cho PixelBuffer và HistoryManager**

```typescript
import { describe, it, expect } from 'vitest';
import { PixelBuffer } from '../src/core/pixel-buffer';
import { HistoryManager } from '../src/core/history-manager';

describe('PixelBuffer', () => {
  it('dat va doc pixel chinh xac', () => {
    const buffer = new PixelBuffer(16, 16);
    buffer.setPixel(5, 5, '#ff0000');
    expect(buffer.getPixel(5, 5)).toBe('#ff0000');
    expect(buffer.getPixel(0, 0)).toBeNull();
  });

  it('nap ma tran ky tu va bang mau chinh xac', () => {
    const buffer = new PixelBuffer(4, 4);
    const matrix = ['.X..', 'XXXX', '.X..', '....'];
    const palette = { X: '#000000', '.': null };
    buffer.fromMatrix(matrix, palette);
    expect(buffer.getPixel(1, 0)).toBe('#000000');
    expect(buffer.getPixel(0, 0)).toBeNull();
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**

Chạy: `npx vitest run apps/studio/tests/pixel-buffer.test.ts`
Kỳ vọng: Thất bại do chưa có code triển khai.

- [ ] **Bước 3: Triển khai `PixelBuffer`, `HistoryManager` và `CanvasEngine`**

Triển khai logic thao tác pixel, lưu trữ lịch sử theo dạng command pattern (mỗi thao tác lưu danh sách pixel bị ghi đè để khôi phục nhanh mà không tốn nhiều bộ nhớ).

- [ ] **Bước 4: Chạy kiểm thử xác nhận thành công**

Chạy: `npx vitest run apps/studio/tests/`
Kỳ vọng: Toàn bộ kiểm thử unit vượt qua.

---

### Tác Vụ 3: Triển Khai Toàn Diện Bộ Công Cụ Vẽ (Drawing Tools)

**Tệp:**
- Tạo mới: `apps/studio/src/tools/base-tool.ts`
- Tạo mới: `apps/studio/src/tools/pencil-tool.ts`
- Tạo mới: `apps/studio/src/tools/eraser-tool.ts`
- Tạo mới: `apps/studio/src/tools/bucket-tool.ts`
- Tạo mới: `apps/studio/src/tools/eyedropper-tool.ts`
- Tạo mới: `apps/studio/src/tools/line-tool.ts`
- Tạo mới: `apps/studio/src/tools/shape-tool.ts`
- Tạo mới: `apps/studio/src/tools/dither-tool.ts`
- Tạo mới: `apps/studio/src/tools/shade-tool.ts`
- Tạo mới: `apps/studio/src/tools/symmetry-manager.ts`
- Kiểm thử: `apps/studio/tests/tools-algorithms.test.ts`

**Giao diện:**
- Cung cấp:
  - `drawLineBresenham(x0, y0, x1, y1)`: Trả về danh sách tọa độ nối 2 điểm.
  - `drawCircleMidpoint(xc, yc, r)`: Trả về danh sách tọa độ đường tròn.
  - `floodFill(buffer, startX, startY, newColor)`: Đổ màu vùng liên thông.
  - `applyDitherPattern(x, y, colorA, colorB)`: Tính màu caro theo tọa độ `(x + y) % 2`.
  - `adjustBrightness(hexColor, percent)`: Tăng/giảm độ sáng cho công cụ Lighten/Darken.

- [ ] **Bước 1: Viết kiểm thử cho các thuật toán vẽ (Bresenham, Midpoint Circle, Flood Fill, Dither)**

```typescript
import { describe, it, expect } from 'vitest';
import { drawLineBresenham } from '../src/tools/line-tool';
import { floodFill } from '../src/tools/bucket-tool';
import { PixelBuffer } from '../src/core/pixel-buffer';

describe('Thuat toan ve pixel', () => {
  it('ve duong thang bresenham khong bo sot pixel', () => {
    const points = drawLineBresenham(0, 0, 3, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 }
    ]);
  });

  it('flood fill do mau dung vung va dung lai o bien', () => {
    const buf = new PixelBuffer(5, 5);
    // Tao khung bao quanh
    buf.setPixel(1, 1, '#000');
    buf.setPixel(1, 2, '#000');
    buf.setPixel(1, 3, '#000');
    floodFill(buf, 0, 0, '#fff');
    expect(buf.getPixel(0, 0)).toBe('#fff');
    expect(buf.getPixel(2, 2)).toBeNull(); // ben trong khung chua bi to
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**

Chạy: `npx vitest run apps/studio/tests/tools-algorithms.test.ts`

- [ ] **Bước 3: Triển khai các công cụ vẽ và bộ quản lý đối xứng gương (SymmetryManager)**

Viết mã nguồn chi tiết cho từng công cụ, chú ý các kích cỡ cọ vẽ 1px, 2px, 3px, 4px cho Pencil và Eraser.

- [ ] **Bước 4: Chạy kiểm thử để xác nhận thành công**

Chạy: `npx vitest run apps/studio/tests/tools-algorithms.test.ts`
Kỳ vọng: Toàn bộ kiểm thử thuật toán vượt qua.

---

### Tác Vụ 4: Xây Dựng Hệ Thống Animation Clips, Timeline và Onion Skinning

**Tệp:**
- Tạo mới: `apps/studio/src/animation/animation-controller.ts`
- Tạo mới: `apps/studio/src/animation/onion-skin-renderer.ts`
- Tạo mới: `apps/studio/src/animation/preview-player.ts`
- Kiểm thử: `apps/studio/tests/animation-controller.test.ts`

**Giao diện:**
- Cung cấp:
  - `AnimationController`: Quản lý danh sách clips/tags (`idle`, `walk`, `attack`), chuyển đổi frame hiện tại, nhân bản frame kèm độ lệch (offset), đặt tốc độ FPS và thời lượng mili-giây từng frame.
  - `OnionSkinRenderer`: Vẽ khung hình trước bằng bóng mờ đỏ (`rgba(255, 50, 50, 0.35)`), khung hình sau bằng bóng mờ xanh (`rgba(50, 200, 50, 0.35)`).
  - `PreviewPlayer`: Bộ phát hoạt ảnh nhỏ độc lập chạy vòng lặp theo clip đang kích hoạt.

- [ ] **Bước 1: Viết kiểm thử cho AnimationController**

```typescript
import { describe, it, expect } from 'vitest';
import { AnimationController } from '../src/animation/animation-controller';
import { createDefaultProject } from '../../../packages/shared-types/src/index';

describe('AnimationController', () => {
  it('them clip va tinh dung chi so frame theo tag', () => {
    const project = createDefaultProject(24, 24, 'NhanVatTest');
    const controller = new AnimationController(project);
    controller.addClip('walk', 4, 10); // 4 frames, 10 fps
    expect(controller.getClip('walk')?.endFrame).toBe(3);
    expect(project.frames.length).toBe(4);
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử xác nhận thất bại**

Chạy: `npx vitest run apps/studio/tests/animation-controller.test.ts`

- [ ] **Bước 3: Triển khai `AnimationController`, `OnionSkinRenderer` và `PreviewPlayer`**

- [ ] **Bước 4: Chạy kiểm thử xác nhận thành công**

Chạy: `npx vitest run apps/studio/tests/animation-controller.test.ts`
Kỳ vọng: Thành công 100%.

---

### Tác Vụ 5: Xây Dựng Giao Diện Studio Hoàn Chỉnh và Tích Hợp Bảng Màu

**Tệp:**
- Tạo mới: `apps/studio/index.html`
- Tạo mới: `apps/studio/src/main.ts`
- Tạo mới: `apps/studio/src/palette/palettes-data.ts`
- Tạo mới: `apps/studio/src/palette/palette-view.ts`
- Tạo mới: `apps/studio/src/ui/top-navbar.ts`
- Tạo mới: `apps/studio/src/ui/left-toolbar.ts`
- Tạo mới: `apps/studio/src/ui/layers-panel.ts`
- Tạo mới: `apps/studio/src/ui/timeline-view.ts`
- Tạo mới: `apps/studio/styles/main.css`
- Kiểm thử hiển thị: Kiểm tra qua trình duyệt hoặc subagent browser.

**Giao diện:**
- Cung cấp:
  - Giao diện Dark theme chuyên nghiệp chuẩn PixAssets Studio.
  - Phím tắt bàn phím: P (Bút chì), E (Tẩy), G (Thùng sơn), I (Ống hút màu), L (Đường thẳng), U (Chữ nhật), C (Tròn), J (Dither), Z (Zoom), Space (Pan), Ctrl+Z / Ctrl+Y.
  - Các bảng màu tích hợp: Pico-8, NES, Game Boy, Endesga-32, Dawnbringer-32.
  - Khung xem trước hoạt ảnh góc dưới bên phải kèm nút Play/Pause và thanh trượt FPS.

- [ ] **Bước 1: Xây dựng dữ liệu bảng màu `palettes-data.ts` và bộ điều khiển `palette-view.ts`**
- [ ] **Bước 2: Xây dựng các thành phần UI: `top-navbar.ts`, `left-toolbar.ts`, `layers-panel.ts`, `timeline-view.ts`**
- [ ] **Bước 3: Tích hợp styling CSS hiện đại, bố cục dạng lưới responsive trong `styles/main.css`**
- [ ] **Bước 4: Lắp ráp vào `apps/studio/src/main.ts` và kiểm tra khởi động Vite server không có lỗi build**

Chạy: `npm run build` trong `apps/studio`
Kỳ vọng: Biên dịch TypeScript và đóng gói Vite thành công không có lỗi.

---

### Tác Vụ 6: Xây Dựng Local Server, WebSocket Bridge và Headless Exporter (apps/server)

**Tệp:**
- Tạo mới: `apps/server/package.json`
- Tạo mới: `apps/server/tsconfig.json`
- Tạo mới: `apps/server/src/server.ts`
- Tạo mới: `apps/server/src/state-store.ts`
- Tạo mới: `apps/server/src/exporter.ts`
- Kiểm thử: `apps/server/tests/exporter.test.ts`
- Kiểm thử: `apps/server/tests/websocket-bridge.test.ts`

**Giao diện:**
- Cung cấp:
  - WebSocket Server lắng nghe tại cổng `3055`.
  - `exportPng(buffer, width, height, scale, outputPath)`: Tạo file PNG chất lượng pixelated sắc nét (Nearest Neighbor) ở các hệ số 1x, 2x, 4x, 8x, 16x.
  - `exportSpriteSheet(frames, width, height, scale, layout, outputPath, jsonMetaPath)`: Tạo file SpriteSheet gộp các khung hình kèm file JSON cấu hình metadata.
  - `StateStore`: Giữ bản sao trạng thái canvas mới nhất, tự động đồng bộ giữa MCP và Studio.

- [ ] **Bước 1: Viết kiểm thử cho logic tạo SpriteSheet và bộ xuất ảnh PNG**

```typescript
import { describe, it, expect } from 'vitest';
import { exportPngBuffer } from '../src/exporter';
import { PixelBuffer } from '../../studio/src/core/pixel-buffer';

describe('Exporter', () => {
  it('xuat buffer anh dung kich thuoc khi phong to scale 4x', async () => {
    const buf = new PixelBuffer(4, 4);
    buf.setPixel(0, 0, '#ff0000');
    const pngBuffer = await exportPngBuffer(buf, 4); // 4x4 scale 4x -> 16x16
    expect(pngBuffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**

Chạy: `npx vitest run apps/server/tests/exporter.test.ts`

- [ ] **Bước 3: Triển khai `exporter.ts`, `state-store.ts` và `server.ts`**

Sử dụng thư viện tạo ảnh thuần Node.js (ví dụ `pngjs`) để tạo file PNG mà không phụ thuộc vào các thư viện C++ native cồng kềnh.

- [ ] **Bước 4: Chạy kiểm thử để xác nhận thành công**

Chạy: `npx vitest run apps/server/tests/`
Kỳ vọng: Toàn bộ kiểm thử xuất file và kết nối WebSocket thành công.

---

### Tác Vụ 7: Xây Dựng Stdio MCP Server (apps/mcp)

**Tệp:**
- Tạo mới: `apps/mcp/package.json`
- Tạo mới: `apps/mcp/tsconfig.json`
- Tạo mới: `apps/mcp/src/index.ts`
- Tạo mới: `apps/mcp/src/tools-handler.ts`
- Tạo mới: `apps/mcp/src/bridge-client.ts`
- Kiểm thử: `apps/mcp/tests/mcp-tools.test.ts`

**Giao diện:**
- Cung cấp 10 công cụ MCP chuẩn:
  1. `create_canvas`
  2. `get_canvas_state`
  3. `draw_matrix`
  4. `draw_pixels`
  5. `draw_shape`
  6. `flood_fill`
  7. `create_animation_clip`
  8. `draw_animation_frame`
  9. `copy_frame_with_offset`
  10. `export_spritesheet`

- [ ] **Bước 1: Viết bài kiểm thử cho các định nghĩa công cụ MCP và hàm xử lý tham số**

```typescript
import { describe, it, expect } from 'vitest';
import { toolsList } from '../src/tools-handler';

describe('MCP Tools Schema', () => {
  it('dinh nghia du 10 cong cu ve pixel va hoat anh', () => {
    const toolNames = toolsList.map(t => t.name);
    expect(toolNames).toContain('draw_matrix');
    expect(toolNames).toContain('create_animation_clip');
    expect(toolNames).toContain('draw_animation_frame');
    expect(toolNames).toContain('export_spritesheet');
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**

Chạy: `npx vitest run apps/mcp/tests/mcp-tools.test.ts`

- [ ] **Bước 3: Triển khai `bridge-client.ts`, `tools-handler.ts` và `index.ts` theo chuẩn `@modelcontextprotocol/sdk`**

Đảm bảo khi Bridge Server không chạy, MCP Server vẫn có thể tự fallback lưu dữ liệu và xuất file trực tiếp vào ổ đĩa.

- [ ] **Bước 4: Chạy kiểm thử để xác nhận thành công**

Chạy: `npx vitest run apps/mcp/tests/mcp-tools.test.ts`
Kỳ vọng: Thành công 100%.

---

### Tác Vụ 8: Xây Dựng và Cài Đặt Custom Skill `pixel-artist`

**Tệp:**
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\SKILL.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\16bit-classic.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\8bit-retro.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\chibi-rpg.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\cyberpunk-scifi.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\lineless-modern.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\styles\custom-template.md`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\templates\humanoid-idle-2f.json`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\templates\humanoid-walk-4f.json`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\templates\gun-recoil-3f.json`
- Tạo mới: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist\templates\slash-attack-3f.json`
- Tạo bản sao dự phòng mẫu trong workspace: `d:\pixel_draw\skills\pixel-artist\...`

**Giao diện:**
- Cung cấp:
  - Hướng dẫn chi tiết cho AI cách phân tích phong cách pixel art, đọc các tệp trong `styles/` và nạp khung xương trong `templates/`.
  - Hướng dẫn cách gọi các công cụ MCP để vẽ nhân vật, hoạt ảnh và xuất file thẳng vào thư mục dự án của người dùng (ví dụ game súng đạn, game web, v.v.).

- [ ] **Bước 1: Viết nội dung cho các Style Profiles (`16bit-classic.md`, `cyberpunk-scifi.md`, `custom-template.md`, v.v.)**
- [ ] **Bước 2: Viết dữ liệu ma trận khung xương cho các hoạt ảnh mẫu trong `templates/`**
- [ ] **Bước 3: Viết tài liệu hướng dẫn chính `SKILL.md` với quy trình 4 bước chuẩn**
- [ ] **Bước 4: Cài đặt và đồng bộ toàn bộ tệp vào thư mục Global Skills tại `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist`**

---

### Tác Vụ 9: Kiểm Thử Toàn Diện Đầu-Cuối (End-to-End Verification)

- [ ] **Bước 1: Khởi động Local Server và kiểm tra cổng WebSocket 3055 hoạt động**
- [ ] **Bước 2: Khởi động Web Studio trên trình duyệt, kiểm tra kết nối WebSocket indicator chuyển sang màu xanh (Connected)**
- [ ] **Bước 3: Dùng script mô phỏng gọi MCP vẽ một nhân vật 24x24 gồm clip `idle` (2 khung hình) và `walk` (4 khung hình)**
- [ ] **Bước 4: Quan sát trên màn hình Studio: Xác nhận các khung hình xuất hiện tức thì, người dùng có thể cầm chuột vẽ đè lên sửa bình thường**
- [ ] **Bước 5: Gọi lệnh xuất SpriteSheet ra file PNG và JSON metadata, xác nhận file được tạo thành công trên ổ cứng và mở xem kiểm tra độ nét của ảnh**

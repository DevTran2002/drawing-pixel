# Kế Hoạch Triển Khai: Bộ Công Cụ Photoshop, Cơ Chế Lưu Trữ Dự Án Toàn Vẹn và Tối Ưu Giao Diện Studio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp Pixel Art Studio với các công cụ chọn vùng nhanh Magic Wand, chỉnh màu HSL/Replace/Invert chuẩn Photoshop, cơ chế lưu trữ dự án toàn vẹn (.pxdraw) tách biệt với hộp thoại xuất ảnh đa định dạng, tái cấu trúc thanh Headbar thành Menu thả xuống và đại tu Kho Lưu Trữ (Gallery 2.0).

**Architecture:** Mở rộng SelectionManager hỗ trợ mặt nạ pixel và thuật toán Flood Fill / Color Match; xây dựng module độc lập ColorAdjustments thực hiện biến đổi màu sắc không gian RGB/HSL; tạo chuẩn file dự án PxDrawProjectFile (.pxdraw); tái cấu trúc thanh Headbar thành hệ sinh thái Menu Bar thả xuống chuẩn Aseprite/Photoshop; hiện đại hóa Gallery Modal với tabs, tìm kiếm, sắp xếp và thẻ dự án phân loại.

**Tech Stack:** TypeScript, Vanilla Canvas API, HTML5/CSS3, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-photoshop-tools-project-storage-and-ui-overhaul-design.md`

## Global Constraints
- Không dùng emoji hoặc icon hình ảnh cảm xúc trong code và bình luận theo quy tắc người dùng.
- Toàn bộ comment giải thích logic nghiệp vụ viết bằng tiếng Việt có dấu.
- Sử dụng tiếng Anh cho tên biến, kiểu dữ liệu, hàm và hằng số (English for values/identifiers).
- Không tự động commit git (Do not auto commit to git).
- Đảm bảo tính tương thích ngược với các dự án đã lưu trong `storage/gallery/`.

## Review Focus
- Vùng chọn Magic Wand với tolerance > 0 và contiguous = false phải bao quát chính xác các pixel tương đồng trên toàn layer.
- Thao tác chỉnh màu HSL hoặc Replace Color khi đang có vùng chọn (Selection Mask) chỉ được biến đổi các pixel bên trong vùng chọn.
- File dự án `.pxdraw` khi tải về máy và mở lại phải bảo toàn 100% tất cả frames, layers, clips, kích thước canvas và trạng thái màu.
- Tải ảnh qua Export Modal (SpriteSheet / PNG) không được làm mất hoặc ghi đè dữ liệu của dự án đang vẽ.
- Giao diện Headbar mới trên màn hình laptop không được xảy ra hiện tượng tràn dòng hay vỡ bố cục.

---

### Task 1: Xây Dựng Engine Mặt Nạ Vùng Chọn & Cây Đũa Thần (Selection Mask & Magic Wand)

**Files:**
- Modify: `apps/studio/src/tools/selection-tool.ts`
- Test: `apps/studio/tests/selection-tool.test.ts`

**Interfaces:**
- Produces:
  - `SelectionManager.selectByWand(startX: number, startY: number, contiguous: boolean, tolerance: number, pixels: Record<string, string>, width: number, height: number): Set<string>`
  - `SelectionManager.isPixelSelected(x: number, y: number): boolean`
  - `SelectionManager.getSelectedMask(): Set<string> | null`
  - `SelectionManager.setCustomMask(mask: Set<string> | null): void`
  - `SelectionManager.getMaskBoundingBox(): SelectionRect | null`

- [ ] **Step 1: Viết test kiểm tra thuật toán Magic Wand và Selection Mask**
Tạo file `apps/studio/tests/selection-tool.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../src/tools/selection-tool';

describe('SelectionManager Magic Wand va Mask', () => {
  let manager: SelectionManager;

  beforeEach(() => {
    manager = new SelectionManager();
  });

  it('chon pixel lien ke cung mau khi contiguous = true', () => {
    const pixels: Record<string, string> = {
      '0,0': '#ff0000',
      '1,0': '#ff0000',
      '0,1': '#ff0000',
      '3,3': '#ff0000' // Pixel tach roi
    };
    const mask = manager.selectByWand(0, 0, true, 0, pixels, 4, 4);
    expect(mask.has('0,0')).toBe(true);
    expect(mask.has('1,0')).toBe(true);
    expect(mask.has('0,1')).toBe(true);
    expect(mask.has('3,3')).toBe(false); // Khong chon pixel tach roi khi contiguous = true
  });

  it('chon toan bo pixel cung mau tren canvas khi contiguous = false', () => {
    const pixels: Record<string, string> = {
      '0,0': '#ff0000',
      '1,0': '#00ff00',
      '3,3': '#ff0000'
    };
    const mask = manager.selectByWand(0, 0, false, 0, pixels, 4, 4);
    expect(mask.has('0,0')).toBe(true);
    expect(mask.has('3,3')).toBe(true);
    expect(mask.has('1,0')).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `npx vitest run apps/studio/tests/selection-tool.test.ts`
Expected: FAIL với lỗi method `selectByWand` chưa tồn tại.

- [ ] **Step 3: Cài đặt thuật toán Magic Wand và Quản lý Mặt nạ trong `apps/studio/src/tools/selection-tool.ts`**
Thêm thuộc tính `customMask: Set<string> | null` vào `SelectionManager`. Cài đặt:
- Hàm so khớp khoảng cách màu RGB theo sai số tolerance.
- Hàm duyệt loang 4 hướng (Breadth-First Search) cho chế độ `contiguous = true`.
- Hàm quét toàn bộ pixel cho chế độ `contiguous = false`.
- Cập nhật các hàm `isPointInsideSelection`, `clearSelection`, `setCustomMask`, và `getMaskBoundingBox`.

- [ ] **Step 4: Chạy test để xác nhận test thành công**
Run: `npx vitest run apps/studio/tests/selection-tool.test.ts`
Expected: PASS toàn bộ 2 tests.

---

### Task 2: Xây Dựng Engine Chỉnh Màu Photoshop (Color Adjustments Engine)

**Files:**
- Create: `apps/studio/src/tools/color-adjustments.ts`
- Test: `apps/studio/tests/color-adjustments.test.ts`

**Interfaces:**
- Produces:
  - `rgbToHsl(r: number, g: number, b: number): [number, number, number]`
  - `hslToRgb(h: number, s: number, l: number): [number, number, number]`
  - `hexToRgb(hex: string): [number, number, number] | null`
  - `rgbToHex(r: number, g: number, b: number): string`
  - `adjustHsl(hex: string, deltaH: number, deltaS: number, deltaL: number): string`
  - `adjustBrightnessContrast(hex: string, brightness: number, contrast: number): string`
  - `invertHexColor(hex: string): string`
  - `replaceHexColor(hex: string, targetHex: string, replacementHex: string, tolerance: number): string`
  - `applyColorAdjustment(pixels: Record<string, string>, options: ColorAdjustmentOptions, selectionMask?: Set<string>): Record<string, string>`

- [ ] **Step 1: Viết test kiểm thử các hàm biến đổi màu sắc**
Tạo file `apps/studio/tests/color-adjustments.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  adjustHsl,
  invertHexColor,
  replaceHexColor,
  applyColorAdjustment
} from '../src/tools/color-adjustments';

describe('Color Adjustments Engine', () => {
  it('chuyen doi qua lai chinh xac giua RGB va HSL', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0); // Do
    expect(h).toBe(0);
    expect(s).toBe(100);
    expect(l).toBe(50);
    const [r, g, b] = hslToRgb(h, s, l);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('dao nguoc mau sac chinh xac', () => {
    expect(invertHexColor('#000000')).toBe('#ffffff');
    expect(invertHexColor('#ffffff')).toBe('#000000');
  });

  it('thay the dung mau theo chi dinh', () => {
    expect(replaceHexColor('#ff0000', '#ff0000', '#0000ff', 0)).toBe('#0000ff');
    expect(replaceHexColor('#00ff00', '#ff0000', '#0000ff', 0)).toBe('#00ff00');
  });

  it('chi ap dung doi mau cho pixel nam trong selection mask', () => {
    const original = {
      '0,0': '#ff0000',
      '1,1': '#ff0000'
    };
    const mask = new Set(['0,0']);
    const result = applyColorAdjustment(original, { type: 'invert' }, mask);
    expect(result['0,0']).toBe('#00ffff');
    expect(result['1,1']).toBe('#ff0000'); // Khong bi thay doi vi ngoai mask
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `npx vitest run apps/studio/tests/color-adjustments.test.ts`
Expected: FAIL vì file `color-adjustments.ts` chưa được tạo.

- [ ] **Step 3: Cài đặt logic trong `apps/studio/src/tools/color-adjustments.ts`**
Cài đặt đầy đủ các thuật toán:
- Chuyển đổi hệ màu RGB sang HSL và ngược lại.
- Tinh chỉnh Hue (-180° đến 180°), Saturation (-100% đến 100%), Lightness (-100% đến 100%).
- Tinh chỉnh Brightness & Contrast theo công thức chuẩn đồ họa.
- Thay thế màu (Color Replace) có tính dung sai Euclidean RGB.
- Hàm `applyColorAdjustment` áp dụng cho danh sách pixel kèm mặt nạ chọn lọc.

- [ ] **Step 4: Chạy test để xác nhận test thành công**
Run: `npx vitest run apps/studio/tests/color-adjustments.test.ts`
Expected: PASS toàn bộ các test cases.

---

### Task 3: Xây Dựng Cấu Trúc Dự Án File .pxdraw (Project File Engine)

**Files:**
- Create: `apps/studio/src/core/project-file.ts`
- Test: `apps/studio/tests/project-file.test.ts`

**Interfaces:**
- Produces:
  - `exportToPxDraw(project: CanvasProject): string`
  - `importFromPxDraw(jsonStr: string): CanvasProject`
  - `validatePxDraw(data: any): boolean`
  - `downloadProjectFile(project: CanvasProject, customName?: string): void`

- [ ] **Step 1: Viết test kiểm tra đóng gói và nạp dự án .pxdraw**
Tạo file `apps/studio/tests/project-file.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { exportToPxDraw, importFromPxDraw, validatePxDraw } from '../src/core/project-file';
import { CanvasProject } from '@pixel-draw/shared-types';

describe('Project File Serializer .pxdraw', () => {
  const sampleProject: CanvasProject = {
    id: 'proj_test',
    name: 'Sample Knight',
    width: 32,
    height: 32,
    activeFrameIndex: 0,
    activeLayerId: 'l1',
    frames: [
      {
        id: 'f1',
        name: 'Frame 1',
        durationMs: 100,
        layers: [
          {
            id: 'l1',
            name: 'Base Layer',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            pixels: { '0,0': '#ff0000' }
          }
        ]
      }
    ],
    clips: []
  };

  it('xuat chuoi JSON hop le va chua du thong tin phien ban 2.0', () => {
    const output = exportToPxDraw(sampleProject);
    const parsed = JSON.parse(output);
    expect(parsed.format).toBe('pxdraw');
    expect(parsed.version).toBe('2.0');
    expect(validatePxDraw(parsed)).toBe(true);
  });

  it('khoi phuc chinh xac du lieu CanvasProject khi doc tu JSON', () => {
    const output = exportToPxDraw(sampleProject);
    const imported = importFromPxDraw(output);
    expect(imported.name).toBe('Sample Knight');
    expect(imported.width).toBe(32);
    expect(imported.frames[0].layers[0].pixels['0,0']).toBe('#ff0000');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
Run: `npx vitest run apps/studio/tests/project-file.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt `apps/studio/src/core/project-file.ts`**
Cài đặt hàm `exportToPxDraw`, `importFromPxDraw`, `validatePxDraw`, và `downloadProjectFile` (sử dụng Blob tải file về máy tính với đuôi `.pxdraw`).

- [ ] **Step 4: Chạy test để xác nhận test thành công**
Run: `npx vitest run apps/studio/tests/project-file.test.ts`
Expected: PASS.

---

### Task 4: Tái Cấu Trúc Thanh Headbar & Triển Khai Hệ Thống Menu Thả Xuống

**Files:**
- Modify: `apps/studio/index.html:11-98`
- Modify: `apps/studio/styles/main.css`
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Consumes: `exportToPxDraw`, `downloadProjectFile`, `ColorAdjustments`
- Produces: Hệ thống Menu Bar (File, Edit, Adjustments, View) và cụm tác vụ nhanh bên phải.

- [ ] **Step 1: Cập nhật cấu trúc HTML cho Headbar trong `apps/studio/index.html`**
Thay thế danh sách 14 nút dàn hàng ngang thành 3 khu vực:
1. `brand-section`: Tên ứng dụng Pixel Studio, huy hiệu kích thước Canvas, huy hiệu Zoom.
2. `nav-menu-bar`: Các nút menu chữ `Tệp (File)`, `Chỉnh sửa (Edit)`, `Màu sắc (Adjustments)`, `Hiển thị (View)` với các dropdown ẩn bên dưới.
3. `nav-quick-actions`: Đèn trạng thái MCP Bridge, nút `Kho Ảnh`, nút `AI Studio`, nút `Export`.
Thêm input file ẩn `#project-file-input` để mở file `.pxdraw`.

- [ ] **Step 2: Viết CSS cho Dropdown Menu trong `apps/studio/styles/main.css`**
Thêm các lớp: `.nav-menu-bar`, `.menu-dropdown-trigger`, `.menu-dropdown-panel`, `.menu-item`, `.menu-shortcut`, `.menu-divider`. Xử lý hiển thị mượt mà với z-index cao và bo góc hiện đại.

- [ ] **Step 3: Cài đặt sự kiện chuyển menu và đóng mở trong `apps/studio/src/main.ts`**
Cài đặt:
- Click vào menu mở panel dropdown.
- Di chuột qua các menu khác khi đang mở để tự động chuyển tab.
- Click ra ngoài hoặc bấm Escape để đóng menu.
- Gắn các hành động:
  - Tệp -> Dự án mới, Mở .pxdraw, Lưu .pxdraw, Lưu vào Kho, Nhập ảnh, Xuất file.
  - Chỉnh sửa -> Undo, Redo, Flip H, Flip V, Rot 90, Đổi cỡ Canvas.
  - Màu sắc -> Mở modal Chỉnh màu (Ctrl+U).
  - Hiển thị -> Toggle Grid, Toggle Pivot, Toggle Sym X, Toggle Onion Skin.

- [ ] **Step 4: Kiểm tra build TypeScript**
Run: `npx vite build --emptyOutDir apps/studio`
Expected: Build thành công không có lỗi type hoặc bundler.

---

### Task 5: Tích Hợp Công Cụ Magic Wand & Hộp Thoại Chỉnh Màu Photoshop Vào UI

**Files:**
- Modify: `apps/studio/index.html`
- Modify: `apps/studio/styles/main.css`
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Consumes: `SelectionManager`, `ColorAdjustments`
- Produces: Magic wand tool button trên toolbar; hộp thoại `#color-adjustments-modal` với chức năng Live Preview.

- [ ] **Step 1: Thêm nút công cụ Magic Wand và HTML Modal Chỉnh Màu trong `apps/studio/index.html`**
- Thêm nút công cụ `data-tool="magicwand"` trên `aside#toolbar` kèm phím tắt `W`.
- Thêm modal `#color-adjustments-modal` gồm các tab:
  - Tab 1: Hue, Saturation, Lightness (các thanh trượt slider).
  - Tab 2: Color Replace (chọn màu cũ, màu mới, dung sai).
  - Tab 3: Brightness / Contrast & Nút Đảo Màu (Invert).
  - Footer: Checkbox `Xem trước trực tiếp (Live Preview)`, nút `Áp dụng` và `Hủy`.

- [ ] **Step 2: Viết CSS cho Hộp Thoại Chỉnh Màu trong `apps/studio/styles/main.css`**
Tạo style cho thanh trượt slider màu gradient cho Hue/Sat/Lightness, hộp xem trước màu nguồn/đích, và bố cục tab chuyển đổi linh hoạt.

- [ ] **Step 3: Tích hợp logic xử lý trong `apps/studio/src/main.ts`**
- Xử lý sự kiện click khi đang chọn công cụ Magic Wand: gọi `selectionManager.selectByWand(...)`, vẽ viền Marching Ants quanh vùng chọn.
- Xử lý sự kiện kéo thanh trượt trong `#color-adjustments-modal`:
  - Khi `Live Preview` bật: cập nhật tức thời layer hiện tại trên canvas.
  - Khi nhấn `Hủy`: hoàn trả lại trạng thái pixel ban đầu.
  - Khi nhấn `Áp dụng`: ghi nhận thay đổi vào `historyManager` để hỗ trợ Undo/Redo.

- [ ] **Step 4: Kiểm tra build TypeScript**
Run: `npx vite build --emptyOutDir apps/studio`
Expected: Build thành công.

---

### Task 6: Nâng Cấp Hộp Thoại Xuất Ảnh Chuyên Nghiệp (Smart Export Modal) & Xử Lý File .pxdraw

**Files:**
- Modify: `apps/studio/index.html`
- Modify: `apps/studio/styles/main.css`
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Consumes: `project-file.ts`, Canvas renderer
- Produces: Hộp thoại xuất ảnh chuyên sâu với các tab: Single PNG (Scale 1x - 16x), Sprite Sheet (Grid / Strip với Padding), GIF; cơ chế kéo thả nạp file `.pxdraw`.

- [ ] **Step 1: Cập nhật giao diện Modal Export trong `apps/studio/index.html`**
Xây dựng lại nội dung `#export-modal` thành các tab rõ ràng:
- Tab 1: Ảnh đơn lẻ PNG (kèm các nút chọn tỉ lệ `1x`, `2x`, `4x`, `8x`, `16x`, chọn nền trong suốt hoặc màu nền).
- Tab 2: Sprite Sheet (tùy chọn dạng Dải ngang Strip hoặc Lưới Grid kèm chọn số cột, padding 0/1/2px, xuất kèm file JSON Atlas).
- Tab 3: Hoạt ảnh GIF (tùy chỉnh FPS và lặp vô tận).

- [ ] **Step 2: Viết CSS cho Export Modal trong `apps/studio/styles/main.css`**
Thêm styles cho cụm nút chọn tỷ lệ scale (`.scale-btn-group`), tùy chọn layout sprite sheet, và khung xem trước kích thước ảnh xuất thực tế.

- [ ] **Step 3: Cài đặt logic xuất ảnh và kéo thả file `.pxdraw` trong `apps/studio/src/main.ts`**
- Cài đặt render ảnh phóng to bằng thuật toán Nearest-Neighbor sắc nét cho từng frame.
- Cài đặt ghép khung hình thành SpriteSheet theo dải ngang hoặc lưới.
- Thêm sự kiện `dragover` và `drop` trên Canvas Studio để khi người dùng kéo thả file `.pxdraw` vào màn hình sẽ tự động mở và nạp dự án.

- [ ] **Step 4: Kiểm tra build TypeScript**
Run: `npx vite build --emptyOutDir apps/studio`
Expected: Build thành công.

---

### Task 7: Đại Tu Kho Ảnh (Gallery 2.0) - Bộ Lọc, Tìm Kiếm, Sắp Xếp & Thẻ Tác Phẩm Thông Minh

**Files:**
- Modify: `apps/studio/index.html`
- Modify: `apps/studio/styles/main.css`
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Consumes: Server API `/api/gallery`, `project-file.ts`
- Produces: Giao diện Kho Ảnh 2.0 với 4 tabs phân loại, thanh tìm kiếm từ khóa, bộ sắp xếp thời gian/tên, và nút thao tác phân định rõ Dự Án vs Ảnh Thường.

- [ ] **Step 1: Cập nhật HTML Modal Kho Ảnh trong `apps/studio/index.html`**
Trong `#gallery-modal`:
- Thêm thanh danh mục tabs: `[Tất cả]`, `[Dự án .pxdraw]`, `[Sprite Hoạt Cảnh]`, `[AI Pixel Art]`.
- Thêm thanh tìm kiếm input `#gallery-search-input` và dropdown sắp xếp `#gallery-sort-select` (Mới nhất, Cũ nhất, Tên A-Z).

- [ ] **Step 2: Viết CSS cho Gallery 2.0 trong `apps/studio/styles/main.css`**
- Style cho thanh tab active, ô tìm kiếm hiện đại có icon kính lúp SVG.
- Style cho thẻ tác phẩm: khung viền phân biệt dự án, huy hiệu thông tin chi tiết (`Dự Án • 4F • 3L`, `AI LoRA`, `Sprite`), và bố cục nút tác vụ gọn gàng.

- [ ] **Step 3: Nâng cấp hàm `loadGallery` trong `apps/studio/src/main.ts`**
- Lọc danh sách theo tab được chọn (Dự án, Sprite đa frame, AI art, Tất cả).
- Lọc theo từ khóa tìm kiếm (so sánh tên hoặc prompt).
- Sắp xếp theo tùy chọn (mới nhất, cũ nhất, chữ cái A-Z).
- Với thẻ Dự Án: Hiển thị các nút `Mở Dự Án`, `Tải .pxdraw`, `Xuất Ảnh`, `Xóa`.
- Với thẻ Ảnh thường / AI: Hiển thị các nút `Mở Canvas`, `Tải PNG`, `Xóa`.

- [ ] **Step 4: Kiểm tra build TypeScript**
Run: `npx vite build --emptyOutDir apps/studio`
Expected: Build thành công không có lỗi.

---

### Task 8: Kiểm Thử Toàn Diện & Xác Thực Hệ Thống

**Files:**
- Run all test suites
- Build production bundle

- [ ] **Step 1: Chạy toàn bộ Unit Tests**
Run: `npx vitest run`
Expected: Toàn bộ các test của selection tool, color adjustments, project file và các module liên quan đều PASS.

- [ ] **Step 2: Chạy Build ứng dụng hoàn chỉnh**
Run: `npm run build`
Expected: Build hoàn tất thành công cho toàn bộ monorepo.

- [ ] **Step 3: Kiểm tra trực quan tương tác**
- Xác thực menu dropdown không bị tràn trên màn hình.
- Xác thực cây đũa thần Magic Wand hoạt động mượt mà.
- Xác thực bảng chỉnh màu HSL đổi màu trực tiếp đúng theo vùng chọn.
- Xác thực tải và nạp file `.pxdraw` giữ nguyên toàn bộ frame/layer.
- Xác thực bộ lọc và tìm kiếm trong kho ảnh hoạt động nhanh và chính xác.

# LPC Modular Palette Shading & AI Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống lắp ráp phụ kiện đa tầng LPC (Body, Hair, Armor, Pants) với cơ chế đổi màu giữ nguyên bóng khối (Palette Recolor & Shading) và tích hợp Re-skin đồng bộ 100% bằng Model AI.

**Architecture:** Xây dựng module Palette Ramp Engine (`lpc-palette.ts`) để ánh xạ các dải màu pixel art từ tối đến sáng mà không làm mất shading; nâng cấp `LpcCompositor` để hỗ trợ layer Z-order kèm bảng màu; cập nhật UI `LpcStudioModal` cho phép người dùng bật/tắt layer và đổi màu tóc/áo/quần trực tiếp; kết nối với AI Studio để Re-skin dải hoạt cảnh hoàn chỉnh ở strength thấp (0.30 - 0.32).

**Tech Stack:** TypeScript, HTML5 Canvas 2D ImageData, Web APIs, Stable Diffusion 1.5 + LoRA Pixel Art, Vite.

**Spec:** `docs/superpowers/specs/2026-10-22-lpc-modular-palette-shading-design.md`

## Global Constraints

- Tuân thủ cấu trúc ma trận chuẩn LPC: 13 cột x 54 hàng, kích thước mỗi ô 64x64 px.
- Giữ nguyên 100% độ trong suốt (Alpha channel) khi thay đổi màu sắc bảng màu.
- Chú thích code hoàn toàn bằng tiếng Việt có dấu.
- Tuyệt đối không tự động commit git.
- Không dùng icon hoặc emoji trong giao diện hoặc phản hồi.

## Review Focus

- Xử lý pixel viền chống răng cưa (anti-aliasing) nhẹ không bị đổi sang màu lạ khi recolor.
- Thứ tự Z-order phải luôn chuẩn xác: Quần (30) < Thân (20 dưới, cơ thể) < Áo giáp (40) < Tóc (50).
- Khi người dùng tắt/bật layer hoặc đổi màu, bộ đệm animation preview phải cập nhật ngay lập tức mà không bị giật lag.
- Khi bấm "Chuyển sang AI Studio", dải strip 64xN xuất ra phải bao gồm đầy đủ tất cả các layer đang bật và đúng màu sắc đã chọn.
- Kiểm tra tính tương thích khi người dùng không chọn tóc hoặc quần (vẫn hoạt động bình thường với phôi cơ thể).

---

### Task 1: Xây Dựng Module Palette Ramp Engine (`lpc-palette.ts`)

**Files:**
- Create: `apps/studio/src/lpc/lpc-palette.ts`

**Interfaces:**
- Produces:
  - `export interface PaletteRamp { id: string; name: string; category: string; colors: string[] }`
  - `export const LPC_PALETTES: Record<string, PaletteRamp[]>`
  - `export function recolorCanvasByPalette(sourceCanvas: HTMLCanvasElement, sourceColors: string[], targetColors: string[]): HTMLCanvasElement`
  - `export function hexToRgb(hex: string): { r: number; g: number; b: number }`

- [ ] **Step 1: Tạo cấu trúc các bảng màu chuẩn LPC**
  Định nghĩa dải màu cho Tóc (Nâu, Vàng hoe, Đỏ hung, Đen tuyền, Bạch kim) và Áo giáp/Quần (Thép xanh, Vàng kim, Đỏ thắm, Xanh ngọc, Da nâu).

- [ ] **Step 2: Viết hàm toán học so khớp màu và thay thế dải màu**
  Cài đặt thuật toán so khớp khoảng cách Euclid RGB giữa màu gốc và dải màu nguồn (`sourceColors`), ánh xạ sang dải màu đích (`targetColors`) mà giữ nguyên Alpha.

- [ ] **Step 3: Kiểm tra biên dịch TypeScript**
  Chạy: `npx tsc --noEmit -p apps/studio/tsconfig.json`
  Kỳ vọng: Không có lỗi kiểu dữ liệu.

---

### Task 2: Tạo Kho Asset Phụ Kiện Chuẩn LPC (`public/lpc_assets/`)

**Files:**
- Create: `apps/studio/public/lpc_assets/hair_warrior.png`
- Create: `apps/studio/public/lpc_assets/armor_plate.png`
- Create: `apps/studio/public/lpc_assets/pants_leather.png`

**Interfaces:**
- Produces: Các tệp ảnh PNG 832x3456 (hoặc dải đồng bộ) chứa các layer Tóc, Áo giáp, Quần khớp từng pixel với phôi cơ thể `sprites.png`.

- [ ] **Step 1: Viết script trích xuất hoặc tổng hợp layer phụ kiện LPC**
  Tạo script Python trích xuất hình thể Tóc, Áo giáp và Quần chuẩn hóa theo vị trí của 54 hàng động tác LPC từ phôi gốc.

- [ ] **Step 2: Lưu các tệp vào thư mục `apps/studio/public/lpc_assets/`**
  Đảm bảo nền trong suốt 100% (Alpha = 0) và đúng kích thước chuẩn.

---

### Task 3: Nâng Cấp `LpcCompositor` Hỗ Trợ Đổi Màu Đa Tầng

**Files:**
- Modify: `apps/studio/src/lpc/lpc-compositor.ts`

**Interfaces:**
- Consumes: `recolorCanvasByPalette`, `LPC_PALETTES` từ `lpc-palette.ts`
- Produces: `LpcAssetItem` có thêm `paletteId?: string`, `cachedRecoloredImage?: HTMLCanvasElement`

- [ ] **Step 1: Bổ sung trường `paletteId` vào interface `LpcAssetItem`**
  Cập nhật interface và hàm `addOrUpdateLayer` để tiếp nhận `paletteId`.

- [ ] **Step 2: Triển khai cơ chế cache recolor**
  Khi layer có `paletteId`, tự động chạy `recolorCanvasByPalette` một lần và lưu vào cache để đảm bảo tốc độ 60 FPS khi phát animation preview.

- [ ] **Step 3: Cập nhật hàm `compositeFrameAt`**
  Vẽ layer từ cache đã đổi màu thay vì ảnh gốc nếu có chỉ định bảng màu.

---

### Task 4: Cập Nhật Giao Diện Bảng Chọn Phụ Kiện Trong `LpcStudioModal`

**Files:**
- Modify: `apps/studio/src/lpc/lpc-studio-modal.ts`

**Interfaces:**
- Consumes: Các layer từ `LpcCompositor` và danh sách bảng màu từ `lpc-palette.ts`.

- [ ] **Step 1: Nạp sẵn danh sách Layer phụ kiện mặc định khi khởi tạo**
  Nạp 4 layer: Phôi cơ thể (Base Body), Mái tóc (Warrior Hair), Áo giáp (Plate Armor), Quần (Leather Pants).

- [ ] **Step 2: Xây dựng UI danh sách Layer mới**
  Mỗi layer có:
  - Checkbox Bật / Tắt.
  - Tên hiển thị rõ ràng.
  - Hộp dropdown chọn bảng màu (Color Palette Select) tương ứng với danh mục của layer đó.

- [ ] **Step 3: Gắn sự kiện thay đổi bảng màu thời gian thực**
  Khi người dùng đổi bảng màu trên dropdown, gọi `compositor.setLayerPalette(layerId, paletteId)` và vẽ lại preview ngay lập tức.

---

### Task 5: Đồng Bộ Cầu Nối Re-skin Sang AI Studio

**Files:**
- Modify: `apps/studio/src/main.ts`
- Modify: `apps/studio/src/lpc/lpc-studio-bridge.ts`

**Interfaces:**
- Consumes: Dải strip hoàn chỉnh đã composite đủ các layer từ `LpcStudioModal`.

- [ ] **Step 1: Cập nhật hàm xuất dải strip trong `lpc-studio-bridge.ts`**
  Đảm bảo dải strip được sinh ra phản ánh chính xác các layer đang bật và màu sắc đã recolor.

- [ ] **Step 2: Cập nhật prompt gợi ý tự động**
  Khi chuyển sang AI Studio, tự động sinh prompt mô tả đúng trang phục đang chọn (ví dụ: "warrior, blonde hair, golden armor, dark pants").

- [ ] **Step 3: Thiết lập strength mặc định cho Re-skin**
  Đặt thanh trượt Strength ở mức `0.32` khi phôi đã có đầy đủ phụ kiện.

---

### Task 6: Kiểm Thử Toàn Diện & Tinh Chỉnh Hiệu Năng

**Files:**
- Toàn bộ dự án

- [ ] **Step 1: Biên dịch toàn bộ ứng dụng**
  Chạy lệnh: `npm run build`
  Kỳ vọng: Không có lỗi TypeScript, Vite bundle thành công.

- [ ] **Step 2: Kiểm thử trực tiếp trên trình duyệt**
  - Mở LPC Character Studio, bật/tắt các layer Tóc, Áo giáp, Quần.
  - Thử đổi màu Tóc (Nâu -> Vàng -> Đỏ) và Áo giáp (Thép xanh -> Vàng kim).
  - Kiểm tra chuyển động các hành động Walk, Slash, Hurt.
  - Bấm "Chuyển sang AI Studio" và chạy render để kiểm chứng độ đồng bộ 100%.

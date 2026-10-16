# AI Studio & Core Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai tính năng AI Generation toàn diện (dựa trên Checkpoint AOM3A1B và LoRA) cùng bộ công cụ nâng cao cho Pixel Studio (Viewport toàn màn hình, Zoom chuẩn tâm, phím Space kéo thả, Selection & Move, Flip & Rotate, Resize Canvas, Import ảnh, và Export đa định dạng).

**Architecture:** Mở rộng hệ thống 3 tầng Monorepo: Frontend Studio (HTML5 Canvas + Vite) kết nối WebSocket và HTTP REST API tới Backend Node.js (cổng 3055), từ đó điều phối tiến trình Python (.venv/Scripts/python.exe) chạy Stable Diffusion 1.5 nạp trực tiếp Checkpoint safetensors và LoRA. Dữ liệu điểm ảnh được tự động chuẩn hóa về kích thước 64x64 hoặc 128x128 và đồng bộ vào layer mới trên Canvas.

**Tech Stack:** TypeScript, HTML5 Canvas API, Node.js, WebSocket (ws), Python 3.10 (.venv), PyTorch, Diffusers, PEFT, Safetensors, OmegaConf.

**Spec:** `docs/superpowers/specs/2026-10-16-ai-studio-enhancements-design.md`

## Global Constraints
- Nền tảng thực thi Python: `.venv/Scripts/python.exe`
- Checkpoint mặc định: `models/checkpoints/AOM3A1B_orangemixs.safetensors`
- LoRA models: `models/lora/th_stardew_portrait_lora.safetensors` và `models/lora/pixel_f2.safetensors`
- Không sử dụng emojis hoặc icons trong phản hồi hoặc UI trừ SVG đồ họa.
- Chú thích mã nguồn (code comments) bằng tiếng Việt theo quy định dự án.
- Không tự động commit git (`Do not auto commit to git`).

## Review Focus
1. **Lệch tâm Viewport khi phóng to (Zoom Drift):** Khi zoom chuột từ 200% lên 2200%, điểm ảnh dưới con trỏ chuột phải đứng yên, không được trôi lệch khỏi màn hình.
2. **Kích thước Canvas và nạp Layer:** Khi ảnh AI 64x64 hoặc 128x128 được nạp vào Canvas 24x24, hệ thống phải mở rộng canvas mượt mà mà không làm mất pixel của các layer vẽ tay cũ.
3. **Phím Spacebar không gây xung đột:** Khi đang gõ chữ trong ô Prompt của modal hoặc ô đổi tên Layer, phím Spacebar phải nhập ký tự khoảng trắng bình thường, không được kích hoạt Hand Tool.
4. **Vùng chọn Selection rỗng:** Khi người dùng nhấn Ctrl+C, Move hoặc Delete mà chưa kéo chọn vùng pixel nào, hệ thống không được phát sinh ngoại lệ runtime.
5. **Tiến trình AI chạy dài trên CPU:** Quá trình sinh ảnh kéo dài ~1-2 phút trên CPU không được làm đóng băng giao diện người dùng (UI) hay làm đứt kết nối WebSocket.

---

### Task 1: Nâng cấp Viewport Toàn Màn Hình & Thu Phóng Chuẩn Tâm (Responsive Viewport & Zoom)

**Files:**
- Modify: `apps/studio/styles/main.css:201-224`
- Modify: `apps/studio/src/core/canvas-engine.ts:70-94`
- Modify: `apps/studio/src/main.ts:232-248`

**Interfaces:**
- Consumes: `CanvasEngine`, `centerViewport`, `panOffset`, `zoom`
- Produces: `resizeViewportToParent()`, `zoomAtPoint(mouseX, mouseY, delta)`

- [ ] **Step 1: Cập nhật CSS để Viewport phủ kín màn hình**
Sửa `.canvas-container` trong `apps/studio/styles/main.css` thành `width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;`, bỏ giới hạn cố định 600x600 px.

- [ ] **Step 2: Cập nhật `CanvasEngine` tự động co giãn kích thước theo container**
Thêm phương thức `resizeToContainer(width: number, height: number)` trong `CanvasEngine`. Đặt `this.canvas.width = width`, `this.canvas.height = height` và tính lại `centerViewport()`.

- [ ] **Step 3: Cài đặt thuật toán Zoom bám theo con trỏ chuột trong `CanvasEngine`**
Viết hàm `zoomAt(clientX: number, clientY: number, deltaZoom: number)`:
```typescript
const targetPixelX = (clientX - this.panOffset.x) / this.zoom;
const targetPixelY = (clientY - this.panOffset.y) / this.zoom;
this.zoom = Math.max(2, Math.min(64, this.zoom + deltaZoom));
this.panOffset.x = Math.round(clientX - targetPixelX * this.zoom);
this.panOffset.y = Math.round(clientY - targetPixelY * this.zoom);
```

- [ ] **Step 4: Tích hợp ResizeObserver và sự kiện Wheel vào `main.ts`**
Trong `apps/studio/src/main.ts`: Khởi tạo `ResizeObserver` theo dõi `.center-viewport` để gọi `canvasEngine.resizeToContainer()`. Cập nhật sự kiện `wheel` để gọi `canvasEngine.zoomAt(e.clientX - rect.left, e.clientY - rect.top, delta)`.

- [ ] **Step 5: Kiểm tra trực quan**
Chạy ứng dụng Studio, cuộn chuột zoom in / zoom out tại các góc canvas khác nhau, xác nhận bức tranh nở đều từ vị trí con trỏ chuột và không bị trôi dạt.

---

### Task 2: Tính Năng Lia Góc Nhìn Bằng Phím Space (Hand / Pan Viewport Tool)

**Files:**
- Modify: `apps/studio/src/core/canvas-engine.ts:80-94`
- Modify: `apps/studio/src/main.ts:160-235`

**Interfaces:**
- Consumes: `panOffset`, `renderAll`
- Produces: `isPanning`, `startPan`, `updatePan`, `endPan`

- [ ] **Step 1: Thêm cờ trạng thái `isSpacePressed` và `isPanning` vào `main.ts`**
Lắng nghe sự kiện `keydown` và `keyup` toàn cục cho phím `Space`:
```typescript
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
    e.preventDefault();
    isSpacePressed = true;
    mainCanvas.style.cursor = 'grab';
  }
});
```

- [ ] **Step 2: Xử lý kéo thả khi đang giữ phím Space**
Trong `mousedown`: nếu `isSpacePressed = true`, ghi nhớ `lastPanPoint = { x: e.clientX, y: e.clientY }`, đặt `mainCanvas.style.cursor = 'grabbing'`.
Trong `mousemove`: nếu đang kéo trong chế độ Pan, tính `dx = e.clientX - lastPanPoint.x`, `dy = e.clientY - lastPanPoint.y`, cộng dồn vào `canvasEngine.panOffset.x += dx`, `canvasEngine.panOffset.y += dy` và gọi `renderAll()`.
Trong `mouseup`: đặt lại con trỏ `grab`.

- [ ] **Step 3: Phím tắt căn giữa `Shift + 0`**
Lắng nghe phím tắt `Shift + 0` để gọi `canvasEngine.centerViewport()` và `renderAll()`.

- [ ] **Step 4: Kiểm tra trực quan**
Nhấn giữ phím `Space`, kéo rê chuột trên canvas, xác nhận toàn bộ khung tranh di chuyển mượt mà theo bàn tay.

---

### Task 3: Backend API Sinh Ảnh AI Với Checkpoint AOM3A1B & LoRA

**Files:**
- Modify: `apps/server/src/ai-helper.ts:66-110`
- Modify: `apps/server/src/server.ts:135-180`
- Modify: `apps/server/src/state-store.ts:80-140`

**Interfaces:**
- Consumes: `.venv/Scripts/python.exe`, `scripts/th_generate_stardew_portrait.py`
- Produces: `POST /api/ai/generate`, `stateStore.addLayerWithPixels(name, pixels, width, height)`

- [ ] **Step 1: Viết hàm gọi Python thông qua `.venv` trong `apps/server/src/ai-helper.ts`**
Cập nhật `generateStardewPortrait` nhận `AiGenerateOptions` (`prompt`, `checkpoint`, `loraPath`, `loraScale`, `steps`, `size`, `resample`, `removeBg`). Sử dụng đường dẫn tuyệt đối `path.join(projectRoot, '.venv', 'Scripts', 'python.exe')` để thực thi script.

- [ ] **Step 2: Thêm phương thức tự động mở rộng Canvas và tạo Layer trong `StateStore`**
Trong `apps/server/src/state-store.ts`, viết phương thức:
```typescript
addAiLayer(pixels: PixelPoint[], width: number, height: number, layerName: string): void
```
Nếu `width > this.project.width || height > this.project.height`, mở rộng kích thước Canvas lên kích thước mới, sau đó tạo một Layer mới và ghi các điểm ảnh vào layer đó.

- [ ] **Step 3: Cập nhật route `POST /api/ai/generate` trong `apps/server/src/server.ts`**
Tiếp nhận payload từ client, gọi `ai-helper`, lấy danh sách pixel từ PNG đầu ra, gọi `stateStore.addAiLayer()`, lưu vào Gallery, và phát sóng `PROJECT_SYNC` qua WebSocket.

- [ ] **Step 4: Kiểm tra lệnh sinh ảnh qua API**
Gửi yêu cầu POST thử nghiệm tới `http://127.0.0.1:3055/api/ai/generate` và xác nhận layer mới được sinh ra với kích thước 64x64.

---

### Task 4: Giao Diện Modal AI Hoàn Chỉnh Với Presets & Cấu Hình Nâng Cao

**Files:**
- Modify: `apps/studio/index.html:245-285`
- Modify: `apps/studio/src/main.ts:700-800`

**Interfaces:**
- Consumes: `POST /api/ai/generate`
- Produces: UI Presets, Advanced Accordion, Generation Progress Status

- [ ] **Step 1: Thiết kế lại cấu trúc HTML cho Modal AI trong `index.html`**
Bổ sung:
1. Bộ 3 thẻ Presets bấm nhanh:
   - "Chân dung Stardew (64x64)"
   - "Chiến binh Pixel RPG (64x64)"
   - "Bối cảnh & Căn phòng (128x128)"
2. Hộp gợi ý từ khóa nhanh (Tag chips) cho nhân vật thị trấn Stardew.
3. Phần "Cấu hình nâng cao" (Collapsible Details/Summary):
   - Dropdown Checkpoint: `AOM3A1B_orangemixs.safetensors`
   - Dropdown LoRA: `th_stardew_portrait_lora.safetensors` & `pixel_f2.safetensors`
   - Slider LoRA Scale (0.5 – 0.9)
   - Slider Steps (12 – 22)
   - Checkbox Tách nền trong suốt
4. Thanh tiến trình hiển thị đếm giây và thông báo trạng thái.

- [ ] **Step 2: Viết logic chuyển đổi Preset và gọi API trong `main.ts`**
Khi người dùng bấm chọn một Preset, tự động điền prompt mẫu, chỉnh slider LoRA scale và size tương ứng. Khi nhấn nút "Sinh Ảnh & Nạp Vào Canvas", gửi payload tới `/api/ai/generate`, hiển thị đếm giây và tự động đóng modal khi hoàn tất.

- [ ] **Step 3: Kiểm tra trực quan trên trình duyệt**
Mở Modal AI trên Studio, chọn Preset Stardew, sinh ảnh và xác nhận Layer mới xuất hiện ngay trên Canvas kèm kích thước tự co giãn.

---

### Task 5: Công Cụ Chọn Vùng (Selection) & Di Chuyển (Move Tool)

**Files:**
- Create: `apps/studio/src/tools/selection-tool.ts`
- Modify: `apps/studio/src/main.ts:250-350`
- Modify: `apps/studio/styles/main.css:80-140`

**Interfaces:**
- Consumes: `CanvasEngine`, `ToolType`
- Produces: `selectedRect`, `clipboardPixels`, phím tắt `S`, `M`, `Ctrl+C`, `Ctrl+V`, `Delete`

- [ ] **Step 1: Thêm nút công cụ Selection (`S`) và Move (`M`) vào Toolbar trong `index.html`**
Tạo hai nút với SVG tương ứng trên thanh công cụ bên trái.

- [ ] **Step 2: Cài đặt logic Selection Rect trong `selection-tool.ts`**
Theo dõi tọa độ `dragStart` và `dragCurrent` để xác định hình chữ nhật bao quanh các điểm ảnh. Vẽ đường viền chấm đứt đoạn (Marching Ants) trên Canvas khi có vùng chọn.

- [ ] **Step 3: Cài đặt thao tác Di chuyển, Sao chép và Xóa trong `main.ts`**
1. Khi chọn Move Tool (`M`): kéo rê vùng chọn để di chuyển các pixel trong buffer của layer hiện tại.
2. Khi nhấn `Ctrl + C`: sao chép mảng pixel nằm trong vùng chọn vào biến clipboard.
3. Khi nhấn `Ctrl + V`: dán mảng pixel vào vị trí hiện tại.
4. Khi nhấn `Delete`: xóa các pixel trong vùng chọn khỏi layer.

- [ ] **Step 4: Kiểm tra công cụ**
Khoanh chọn một vùng nhân vật vừa vẽ, nhấn kéo sang vị trí khác và kiểm tra Undo/Redo.

---

### Task 6: Bộ Công Cụ Biến Đổi Hình Học (Flip Horizontal, Flip Vertical, Rotate 90°)

**Files:**
- Modify: `apps/studio/index.html:40-75`
- Modify: `apps/studio/src/main.ts:360-420`

**Interfaces:**
- Consumes: `activeLayerBuffer`, `selectedRect`
- Produces: `flipHorizontal()`, `flipVertical()`, `rotate90()`

- [ ] **Step 1: Thêm các nút bấm Flip H, Flip V, Rotate 90° trên thanh điều hướng `top-nav`**
Thêm các nút nhỏ kèm SVG biểu tượng lật và xoay trên thanh điều hướng trên cùng.

- [ ] **Step 2: Cài đặt thuật toán biến đổi ma trận pixel trong `main.ts`**
- Flip Horizontal: `newX = (selectedRect ? selectedRect.x + selectedRect.width - 1 - (p.x - selectedRect.x) : width - 1 - p.x)`.
- Flip Vertical: `newY = height - 1 - p.y`.
- Rotate 90° Clockwise: hoán đổi hàng cột cho các pixel.
Lưu lại trạng thái vào `undoStack` trước khi biến đổi để có thể Undo.

- [ ] **Step 3: Kiểm tra biến đổi**
Nhấn nút Flip H và xác nhận nhân vật quay mặt sang hướng ngược lại chuẩn xác.

---

### Task 7: Hộp Thoại Đổi Kích Thước Canvas (Canvas Resize Modal)

**Files:**
- Modify: `apps/studio/index.html:13-17`
- Modify: `apps/studio/src/main.ts:430-510`
- Modify: `apps/server/src/state-store.ts:140-180`

**Interfaces:**
- Consumes: `stateStore.resizeCanvas`
- Produces: Modal Resize Canvas với các cỡ 16, 24, 32, 48, 64, 128 và Custom

- [ ] **Step 1: Tạo Modal Resize Canvas trong `index.html`**
Gồm các nút bấm chọn cỡ nhanh (16x16, 24x24, 32x32, 48x48, 64x64, 128x128), ô nhập số `Width` và `Height`, lựa chọn Anchor (Center, Top-Left, Bottom-Center), và nút áp dụng.

- [ ] **Step 2: Viết logic co giãn Canvas và căn neo điểm ảnh trong `state-store.ts`**
Hỗ trợ mở rộng/thu hẹp khung vẽ với độ lệch tọa độ tính theo Anchor đã chọn, giữ nguyên vị trí chân nhân vật khi chọn Bottom-Center.

- [ ] **Step 3: Kết nối nút kích hoạt trên thanh `top-nav`**
Click vào badge kích thước `24x24 px` trên thanh điều hướng để mở nhanh hộp thoại Resize.

---

### Task 8: Nhập Ảnh Từ Máy Tính & Mở Rộng Xuất Tệp (Import & Multi-Format Export)

**Files:**
- Modify: `apps/studio/index.html:65-75`
- Modify: `apps/studio/src/main.ts:520-650`

**Interfaces:**
- Consumes: `FileReader`, `canvasEngine`
- Produces: Import Image to Layer, Export Single PNG (1x-16x), Export SpriteSheet

- [ ] **Step 1: Bổ sung tính năng Nhập ảnh (Import Image)**
Thêm nút "Import" trên top-nav và sự kiện `dragover`/`drop` trên Canvas. Đọc tệp ảnh của người dùng, tự động vẽ vào canvas phụ để trích xuất các điểm ảnh pixelated và đặt vào một Layer mới `Imported_Image`.

- [ ] **Step 2: Mở rộng Modal Export**
Thêm tùy chọn xuất:
1. SpriteSheet PNG kèm JSON.
2. Khung hình hiện tại (Single Frame PNG) với các hệ số phóng đại `1x`, `2x`, `4x`, `8x`, `16x`.
3. Tải trực tiếp về máy tính người dùng qua thẻ `<a>` download.

- [ ] **Step 3: Kiểm tra hoàn tất toàn bộ luồng hoạt động**
Xác nhận nhập ảnh ngoài thành công và xuất ảnh pixel phóng to 8x sắc nét.

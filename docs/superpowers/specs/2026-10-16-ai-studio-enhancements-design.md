# Đặc Tả Thiết Kế: Tích Hợp AI Generation & Mở Rộng Tính Năng Pixel Studio

- **Ngày lập:** 16-10-2026
- **Trạng thái:** Chờ phê duyệt (Draft)
- **Tác giả:** AI Coding Assistant & User

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

Dự án `pixel_draw` là một monorepo gồm:
- `apps/studio`: Ứng dụng web Single Page Application (Vite + TypeScript + HTML5 Canvas) dùng cho thiết kế đồ họa điểm ảnh (Pixel Art) và hoạt ảnh (Animation Spritesheet).
- `apps/server`: Máy chủ Node.js cục bộ kết hợp WebSocket Bridge (cổng 3055) và REST API.
- `scripts/`: Bộ script Python sinh ảnh AI sử dụng PyTorch, Diffusers và LoRA.

### Mục tiêu dự án
1. **Tiểu dự án 1 (AI Generation Module):** Tích hợp hoàn chỉnh tính năng sinh ảnh pixel AI trực tiếp trên giao diện Studio. Cho phép chạy dựa trên checkpoint chất lượng cao `models/checkpoints/AOM3A1B_orangemixs.safetensors`, hỗ trợ linh hoạt các LoRA (`pixel_f2.safetensors` và `th_stardew_portrait_lora.safetensors`), cung cấp các preset đặc trưng của Stardew Valley (chân dung 64x64) và RPG pixel art (128x128), tự động tạo Layer mới và co giãn Canvas thông minh.
2. **Tiểu dự án 2 (Studio Advanced Features):** Nâng cấp ứng dụng Pixel Studio vượt lên trên các tính năng cơ bản, bổ sung bộ công cụ chọn vùng & di chuyển (Selection & Move), biến đổi hình học (Flip & Rotate), thay đổi kích thước Canvas tự do (Canvas Resizer), nhập ảnh ngoài vào layer (Image Import), và xuất ảnh động GIF (Animated GIF Export).

---

## 2. Kiến Trúc Hệ Thống (Architecture & Subsystems)

Hệ thống được chia thành 3 tầng kết nối liền mạch:

```
+-------------------------------------------------------------------+
|                        Apps/Studio (Frontend)                     |
|  - Toolbar: Pen, Eraser, Fill, Selection (S), Move (M)            |
|  - Transform Bar: Flip H, Flip V, Rotate 90°                      |
|  - Canvas Viewport: Tự co giãn theo kích thước tranh (64, 128)    |
|  - Modals: AI Generation Modal, Canvas Resize Modal, Export Modal |
+---------------------------------+---------------------------------+
                                  |
               HTTP REST API (3055)| WebSocket Events
                                  v
+---------------------------------+---------------------------------+
|                        Apps/Server (Backend)                      |
|  - ai-helper.ts: Điều phối tiến trình Python qua .venv             |
|  - server.ts: Định tuyến API /api/ai/generate, /api/canvas/resize |
|  - state-store.ts: Quản lý ma trận pixel đa tầng (Multi-layers)   |
|  - gallery-manager.ts: Tự động lưu trữ và đồng bộ hóa thư viện    |
+---------------------------------+---------------------------------+
                                  |
                                  | ChildProcess CLI
                                  v
+---------------------------------+---------------------------------+
|                   Python AI Inference Engine                      |
|  - Runtime: .venv/Scripts/python.exe (Python 3.10)                |
|  - Script: scripts/th_generate_stardew_portrait.py                |
|  - Checkpoint: models/checkpoints/AOM3A1B_orangemixs.safetensors  |
|  - LoRAs: th_stardew_portrait_lora & pixel_f2                    |
+-----------------------------------+-------------------------------+
```

---

## 3. Chi Tiết Kỹ Thuật Từng Phân Hệ

### 3.1. Tiểu Dự Án 1: Hệ Thống AI Generation Trên Giao Diện

#### A. Backend & Python Integration (`apps/server/src/ai-helper.ts`)
- **Trình thực thi:** Gọi trực tiếp `.venv/Scripts/python.exe` từ thư mục gốc của dự án thay vì qua lệnh `uv` không ổn định trên Windows.
- **Giao diện tham số:**
  ```typescript
  export interface AiGenerateOptions {
    prompt: string;
    checkpoint?: string; // Mặc định: models/checkpoints/AOM3A1B_orangemixs.safetensors
    loraPath?: string;   // models/lora/th_stardew_portrait_lora hoặc pixel_f2
    loraScale?: number;  // 0.55 - 0.70
    steps?: number;      // 12 - 20 (mặc định 14)
    size?: number;       // 64 hoặc 128
    resample?: 'NEAREST' | 'LANCZOS'; // Mặc định: NEAREST
    removeBg?: boolean;  // Tách nền trong suốt
  }
  ```
- **Xử lý kết quả trả về và đồng bộ Canvas:**
  - Đọc tệp ảnh PNG đầu ra thành danh sách điểm ảnh `{ x, y, color: hex }` qua `loadPngToPixels`.
  - Nếu kích thước ảnh (`size`) khác kích thước Canvas hiện tại: Tự động gọi `stateStore.resizeCanvas(size, size, 'center')` để mở rộng hoặc thu hẹp Canvas mà không làm mất các pixel ở các layer cũ.
  - Tự động tạo một Layer mới với định dạng tên `AI_${new Date().toLocaleTimeString()}` và gán điểm ảnh vào layer này.
  - Phát sự kiện WebSocket `PROJECT_SYNC` cho toàn bộ các client đang mở Studio.

#### B. Giao diện Modal AI (`apps/studio/index.html`, `apps/studio/src/main.ts`)
- **1-Click Presets:**
  1. **Chân dung Stardew (64x64):**
     - LoRA: `models/lora/th_stardew_portrait_lora.safetensors`
     - LoRA Scale: `0.7`
     - Prompt mẫu: `stardew valley style, pixel art portrait, dialogue portrait, 1girl, red hair, braid, green jacket, warm smile, upper body, clean cluster shading, organic outline, simple background`
     - Kích thước: `64x64`
  2. **Hiệp sĩ / Nhân vật RPG (64x64):**
     - LoRA: `models/lora/pixel_f2.safetensors`
     - LoRA Scale: `0.55`
     - Prompt mẫu: `pixel, chibi, 1boy, solo, armor, holding sword, brown hair, blue eyes, full body, standing, simple background, white background`
     - Kích thước: `64x64`
  3. **Cảnh vật & Căn phòng chi tiết (128x128):**
     - LoRA: `models/lora/pixel_f2.safetensors`
     - LoRA Scale: `0.55`
     - Prompt mẫu: `pixel, no humans, scenery, indoors, room, bookshelf, table, chair, potted plant, window, cozy warm atmosphere`
     - Kích thước: `128x128`
- **Bộ Tags gợi ý nhanh cho phong cách Stardew:**
  - Nữ tóc đỏ (Leah/Robin), Nữ tóc tím (Abigail), Nam áo sơ mi flannel, Nam thợ mộc, Ông lão làng, Phù thủy áo choàng...
- **Khu vực Tùy chỉnh Nâng cao (Collapsible Advanced Settings):**
  - Checkpoint selector: `AOM3A1B_orangemixs.safetensors` (mặc định) hoặc chọn model khác.
  - LoRA selector: Dropdown chọn LoRA có sẵn trong thư mục `models/lora/`.
  - LoRA Scale: Thanh trượt từ 0.1 đến 1.0 (bước nhảy 0.05).
  - Sampling Steps: Thanh trượt từ 10 đến 25 bước (hiển thị thời gian ước tính tương ứng: ~1 phút cho 12-14 bước, ~2 phút cho 18 bước).
  - Tách nền checkbox: Tùy chọn tách nền trong suốt hoặc giữ màu nền hộp thoại game.

---

### 3.2. Tiểu Dự Án 2: Bộ Tính Năng Nâng Cao Cho Pixel Studio

#### A. Mở Rộng Viewport Tràn Màn Hình & Thu Phóng Giữ Tâm Cân Đối (Infinite Viewport & Cursor-Centric Zoom)
- **Khắc phục lỗi khung hẹp (Fixed 600x600 px):**
  - Hiện tại canvas bị giới hạn cứng trong khung 600x600 px dẫn đến cảm giác chật chội và bị che khuất khi zoom to.
  - Loại bỏ kích thước cố định, cấu hình `#main-canvas` tự động co giãn khớp **100% diện tích thực tế** của vùng làm việc `.center-viewport` thông qua `ResizeObserver`. Không gian vẽ sẽ tràn toàn bộ màn hình giữa toolbar và sidebar.
- **Khắc phục lỗi lệch tâm khi Zoom In / Zoom Out:**
  - Hiện tại khi cuộn chuột, hệ thống chỉ thay đổi hệ số `zoom` mà không cập nhật lại tọa độ dịch chuyển `panOffset`, khiến bức tranh bị trôi lệch sang góc dưới bên phải như ảnh phản ánh của người dùng.
  - **Thuật toán Zoom bám theo con trỏ chuột (Zoom to Mouse Position):**
    ```typescript
    // Tinh toa do pixel ben duoi con tro truoc khi zoom
    const targetPixelX = (mouseX - panOffset.x) / oldZoom;
    const targetPixelY = (mouseY - panOffset.y) / oldZoom;
    // Cap nhat he so zoom moi
    zoom = newZoom;
    // Tinh lai do lech panOffset de giu diem anh dung nguyen tai vi tri con tro chuot
    panOffset.x = Math.round(mouseX - targetPixelX * newZoom);
    panOffset.y = Math.round(mouseY - targetPixelY * newZoom);
    ```
- **Nút Căn Giữa & Đặt Lại Góc Nhìn (Fit View / Reset Center):**
  - Bổ sung nút **Center View** (hoặc phím tắt `Shift + 0`): Tự động tính toán mức zoom phù hợp và đặt bức tranh vào chính giữa màn hình một cách cân đối tuyệt đối.
  - Tự động gọi căn giữa khi người dùng tạo canvas mới, mở ảnh từ thư viện, hoặc khi AI sinh xong ảnh mới.

#### B. Công cụ Lia Khung Vẽ Bằng Phím Space (Hand / Pan Viewport Tool)
- **Cơ chế giữ phím Spacebar:**
  - Khi người dùng **nhấn và giữ phím `Space`**: Tạm thời kích hoạt Hand Tool, con trỏ chuột chuyển sang dạng bàn tay mở (`cursor: grab`).
  - **Giữ chuột trái và kéo:** Lia chuyển động khung nhìn Canvas (`panOffset.x += deltaX`, `panOffset.y += deltaY`) mượt mà, con trỏ chuyển sang dạng bàn tay nắm (`cursor: grabbing`). Tính năng này cực kỳ hữu ích khi phóng to tranh ở mức Zoom lớn (800% – 2200%) trên các canvas 64x64 và 128x128.
  - Khi **nhả phím `Space`**: Con trỏ và công cụ tự động hoàn trả lại công cụ vẽ trước đó (Pencil, Eraser, Selection, v.v.).

#### C. Công cụ Chọn vùng & Di chuyển (Selection & Move Tool)
- **Công cụ Rectangular Selection (`data-tool="select"`, Phím tắt `S`):**
  - Kéo chuột trên canvas để xác định vùng bao chữ nhật `selectionRect = { startX, startY, width, height }`.
  - Vẽ viền chấm chuyển động (Marching Ants / Dotted stroke) để người dùng nhận diện vùng đang chọn.
- **Công cụ Move (`data-tool="move"`, Phím tắt `M`):**
  - Kéo thả các pixel nằm trong vùng chọn sang tọa độ mới trên layer hiện tại.
- **Thao tác bàn phím:**
  - `Ctrl + C`: Lưu các pixel trong vùng chọn vào clipboard nội bộ.
  - `Ctrl + V`: Dán pixel đã lưu tại góc trên bên trái của viewport hoặc vị trí con trỏ chuột.
  - `Delete` / `Backspace`: Xóa toàn bộ pixel bên trong vùng chọn.
  - `Escape`: Bỏ vùng chọn.

#### D. Công cụ Biến đổi (Transformations: Flip & Rotate)
- Bổ sung nút bấm trên thanh công cụ phụ hoặc menu ngữ cảnh:
  - **Flip Horizontal:** Đảo ngược thứ tự cột pixel `x' = width - 1 - x` (trên layer hiện tại hoặc bên trong vùng chọn).
  - **Flip Vertical:** Đảo ngược thứ tự hàng pixel `y' = height - 1 - y`.
  - **Rotate 90° Clockwise:** Hoán đổi ma trận tọa độ `(x, y) -> (height - 1 - y, x)` và cập nhật kích thước tương ứng nếu canvas vuông.
- Mọi thao tác biến đổi đều được đưa vào ngăn xếp Undo/Redo để có thể hoàn tác ngay lập tức.

#### E. Hộp thoại Đổi Kích Thước Canvas (Canvas Resize Modal)
- Nút **Resize** trên thanh điều hướng mở hộp thoại cấu hình:
  - Các kích thước tiêu chuẩn: 16x16, 24x24, 32x32, 48x48, 64x64, 128x128.
  - Cho phép nhập tùy ý `Width` và `Height` (giới hạn an toàn từ 8 đến 256 pixel).
  - Chế độ căn lề neo (Anchor Position): Center (giữa), Top-Left (góc trên trái), Bottom-Center (đáy giữa - giữ cố định chân nhân vật).
  - Chế độ xử lý:
    - *Expand/Crop Canvas:* Giữ nguyên pixel, chỉ thay đổi khung bao.
    - *Rescale Content (Nearest Neighbor):* Phóng to hoặc thu nhỏ tỷ lệ pixel hiện có theo kích thước mới.

#### E. Nhập Ảnh Ngoài Vào Layer (Image Import)
- Nút **Import** trên thanh điều hướng hoặc sự kiện Kéo - Thả (Drag & Drop) tệp ảnh vào vùng Canvas:
  - Đọc tệp qua `FileReader` và vẽ tạm vào một `OffscreenCanvas`.
  - Tự động lượng tử hóa màu (Color Quantization) và ánh xạ sang kích thước canvas hiện tại.
  - Đặt dữ liệu vào một Layer mới có tên `Imported_Asset`.

#### F. Mở Rộng Xuất File (Export Modal: SpriteSheet, Single Frame, Animated GIF)
- Nâng cấp nút **Export** thành cửa sổ tùy chọn xuất tệp chuyên nghiệp:
  1. **SpriteSheet PNG:** Ghép nối các frame hoạt cảnh thành 1 dải ngang hoặc lưới kèm tệp JSON metadata.
  2. **Single Frame PNG:** Xuất khung hình hiện tại với các độ phóng đại sắc nét (`1x`, `2x`, `4x`, `8x`, `16x`) không mờ viền.
  3. **Animated GIF:** Tích hợp bộ mã hóa GIF nhẹ để xuất chuỗi frame thành tệp `.gif` chạy theo đúng tốc độ FPS của Timeline.

---

## 4. Xử Lý Lỗi & Trường Hợp Biên (Error Handling & Edge Cases)

1. **Bộ nhớ RAM và xử lý CPU:**
   - Khi sinh ảnh 128x128, mạng UNet sẽ xử lý nhiều phép tính hơn 64x64. Script sẽ tự động dọn dẹp biến tạm và gọi `gc.collect()` sau mỗi lần sinh ảnh để giải phóng bộ nhớ.
2. **Kích thước Canvas không khớp:**
   - Khi đưa ảnh 64x64 hoặc 128x128 vào một Canvas đang có kích thước nhỏ hơn (ví dụ 24x24), hệ thống tự động mở rộng Canvas mà không cắt bớt hay làm méo các nét vẽ cũ.
3. **Mất kết nối WebSocket Bridge:**
   - Nếu WebSocket bị ngắt kết nối, nút sinh ảnh AI trên giao diện sẽ hiển thị cảnh báo yêu cầu kiểm tra server Node.js tại cổng 3055.
4. **Phím tắt xung đột:**
   - Các phím tắt `S`, `M`, `Ctrl+C`, `Ctrl+V` chỉ hoạt động khi tiêu điểm (focus) nằm trên vùng Canvas, không chặn thao tác gõ chữ bên trong các ô nhập Prompt.

---

## 5. Chiến Lược Kiểm Thử (Verification Strategy)

1. **Kiểm thử AI Backend & API:**
   - Gửi yêu cầu kiểm tra API `/api/ai/generate` với checkpoint `AOM3A1B_orangemixs.safetensors` và LoRA Stardew, kiểm tra thời gian trả về và tính toàn vẹn của danh sách `PixelPoint`.
2. **Kiểm thử giao diện Studio:**
   - Mở giao diện trên trình duyệt tại `http://localhost:5173`.
   - Kiểm tra mở Modal AI, bấm chọn các Preset (Stardew, RPG Chibi, Scenery), nhấn sinh ảnh và xác nhận Layer mới xuất hiện trên Canvas đúng kích thước 64x64 và 128x128.
   - Thử nghiệm các công cụ mới: Chọn vùng (Selection), di chuyển pixel (Move), lật ngang (Flip H), đổi kích thước canvas (Resize), và nhập ảnh ngoài (Import).

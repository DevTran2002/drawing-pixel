# Kế Hoạch Triển Khai: Phân Hệ LPC Character Studio & Motion Rig

> **Dành cho kỹ sư triển khai:** Kế hoạch này triển khai kiến trúc đã duyệt tại [2026-10-22-lpc-character-studio-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-22-lpc-character-studio-design.md).
> Lưu ý các quy tắc bắt buộc của dự án:
> - Không tạo file test tự động theo quy tắc dự án (`Not create file test`). Sử dụng `npm run build` và TypeScript typecheck để nghiệm thu mã nguồn.
> - Không tự động commit git (`Do not auto commit to git`).
> - Toàn bộ chú thích trong code viết bằng tiếng Việt có dấu đầy đủ.
> - Tên biến, hàm, kiểu dữ liệu sử dụng tiếng Anh chuẩn.

**Mục tiêu:** Xây dựng phân hệ LPC Character Studio cho phép bóc tách phôi Universal LPC 54 hàng (`832x3456`, ô 64x64), ghép lớp Paper Doll thời gian thực với xem trước 4 hướng, hỗ trợ nạp trực tiếp vào Timeline và Canvas của Studio.

**Kiến trúc:** 
- Mô-đun hóa độc lập trong thư mục `apps/studio/src/lpc/` để giữ gìn tính gọn gàng cho `main.ts`.
- Gồm 4 thành phần chính: Bảng ánh xạ ma trận (`lpc-matrix.ts`), Trình ghép lớp đa tầng (`lpc-compositor.ts`), Bộ chuyển đổi đồng bộ Studio (`lpc-studio-bridge.ts`), và Giao diện Modal 3 cột (`lpc-studio-modal.ts`).
- Đồng bộ trực tiếp với các kiểu dữ liệu `CanvasProject`, `AnimationClip`, `FrameData`, `LayerData` trong `packages/shared-types`.

**Ngăn xếp công nghệ:** TypeScript, HTML5 Canvas 2D API, Vite, CSS Vanilla Dark Mode.

**Tài liệu đặc tả:** [2026-10-22-lpc-character-studio-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-22-lpc-character-studio-design.md)

## Ràng Buộc Toàn Cục

- Kích thước lưới chuẩn: 832x3456 px, 13 cột x 54 hàng, ô frame 64x64 px.
- Điểm neo cố định: x = 32, y = 63.
- Thứ tự phân tầng Z-Order: Shadow (10) -> Body (20) -> Eyes (30) -> Legs (40) -> Torso (50) -> Hair (60) -> Weapons (70).
- Chú thích mã nguồn tiếng Việt có dấu 100%.

## Trọng Tâm Nghiệm Thu (Review Focus)

1. Tọa độ cắt ma trận: Đảm bảo cắt chính xác từng ô 64x64 không bị lẹm 1 pixel sang khung lân cận trên dải 13 cột và 54 hàng.
2. Tối ưu hóa bộ nhớ đệm: Canvas xem trước phải dùng Offscreen Canvas với `imageSmoothingEnabled = false` để giữ độ nét pixel sắc cạnh.
3. Điểm neo chân không rung lắc: Các chuỗi Walk cycle 4 hướng khi phát lặp (loop) phải đứng vững tại đáy canvas.
4. Tương thích cấu trúc Studio: Khung hình nạp vào Canvas hoặc Timeline phải hiển thị chuẩn xác trên hệ thống Layer và Timeline của Pixel Draw Studio.
5. Xử lý thiếu layer: Nếu người dùng không chọn tóc hoặc vũ khí, nhân vật vẫn render bình thường mà không phát sinh ngoại lệ null.

---

### Nhiệm Vụ 1: Xây Dựng Từ Điển Ma Trận LPC 54 Hàng (`apps/studio/src/lpc/lpc-matrix.ts`)

**File tạo mới:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-matrix.ts`

**Giao diện & Chức năng:**
- Xuất các kiểu dữ liệu: `LpcDirection`, `LpcActionRow`, `LpcActionGroup`.
- Xuất hằng số `LPC_GRID_CONFIG`: `sheetWidth = 832`, `sheetHeight = 3456`, `frameWidth = 64`, `frameHeight = 64`, `maxCols = 13`, `totalRows = 54`, `pivotX = 32`, `pivotY = 63`.
- Xuất danh mục `LPC_ACTIONS`: Bảng ánh xạ đầy đủ 54 hàng gồm Spellcast (hàng 0-3), Thrust (hàng 4-7), Walk (hàng 8-11), Slash (hàng 12-15), Shoot (hàng 16-19), Hurt (hàng 20), và các tư thế mở rộng.
- Hàm tiện ích `getLpcFrameRect(col: number, row: number)` trả về `{ x, y, width, height }`.

**Các bước thực hiện:**
- [ ] **Bước 1.1:** Tạo thư mục `apps/studio/src/lpc/` nếu chưa có.
- [ ] **Bước 1.2:** Tạo file `apps/studio/src/lpc/lpc-matrix.ts`, định nghĩa toàn bộ types, constants và bảng tra cứu ma trận 54 hàng với chú thích tiếng Việt có dấu.
- [ ] **Bước 1.3:** Kiểm tra biên dịch TypeScript bằng lệnh `npx tsc --noEmit` trong thư mục `apps/studio`.

---

### Nhiệm Vụ 2: Xây Dựng Trình Ghép Lớp Đồ Họa Đa Tầng (`apps/studio/src/lpc/lpc-compositor.ts`)

**File tạo mới:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-compositor.ts`

**Giao diện & Chức năng:**
- Quản lý danh sách các layer phụ kiện (`LpcAssetItem`).
- Sắp xếp và vẽ các layer theo thứ tự Z-Order từ 10 đến 70 lên một Canvas ẩn `64x64`.
- Quản lý vòng lặp hoạt cảnh: `currentAction`, `currentDirection`, `currentFrame`, `fps`, `isPlaying`.
- Cung cấp hàm `renderCurrentFrame(targetCtx: CanvasRenderingContext2D, destWidth: number, destHeight: number)`.
- Cung cấp hàm `getCompositeCanvas(): HTMLCanvasElement`.

**Các bước thực hiện:**
- [ ] **Bước 2.1:** Tạo file `apps/studio/src/lpc/lpc-compositor.ts`.
- [ ] **Bước 2.2:** Cài đặt lớp `LpcCompositor` với đầy đủ các phương thức nạp ảnh, chuyển đổi động tác/hướng nhìn, tính toán frame index và vẽ phân tầng với `imageSmoothingEnabled = false`.
- [ ] **Bước 2.3:** Kiểm tra biên dịch TypeScript bằng lệnh `npx tsc --noEmit`.

---

### Nhiệm Vụ 3: Xây Dựng Bộ Chuyển Đổi Đồng Bộ Studio (`apps/studio/src/lpc/lpc-studio-bridge.ts`)

**File tạo mới:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-studio-bridge.ts`

**Giao diện & Chức năng:**
- Hàm `canvasToLayerData(canvas: HTMLCanvasElement, layerId: string, layerName: string): LayerData`: Chuyển đổi dữ liệu pixel trên Canvas thành Record `pixels` theo chuẩn `shared-types`.
- Hàm `createAnimationClipFromLpc(compositor: LpcCompositor, actionId: string, direction: LpcDirection): AnimationClip`: Cắt từng khung hình của một hành động, tạo mảng `FrameData` và trả về `AnimationClip` hoàn chỉnh.
- Hàm `exportLpcSpritesheetAtlas(compositor: LpcCompositor, actionIds?: string[]): { atlasBlob: Blob, jsonMetadata: object }`.

**Các bước thực hiện:**
- [ ] **Bước 3.1:** Tạo file `apps/studio/src/lpc/lpc-studio-bridge.ts`.
- [ ] **Bước 3.2:** Triển khai logic đọc ImageData từ Canvas và chuyển thành cấu trúc `LayerData` và `AnimationClip` của Pixel Draw Studio.
- [ ] **Bước 3.3:** Kiểm tra biên dịch TypeScript bằng `npx tsc --noEmit`.

---

### Nhiệm Vụ 4: Xây Dựng Giao Diện Bảng Điều Khiển LPC Studio Modal (`apps/studio/src/lpc/lpc-studio-modal.ts`)

**File tạo mới:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-studio-modal.ts`

**Giao diện & Chức năng:**
- Tạo DOM cho Modal LPC Studio gồm:
  - Cột 1: Danh sách phụ kiện theo phân nhóm (Thân/Màu da, Tóc, Quần, Áo, Vũ khí).
  - Cột 2: Khung Canvas Live Preview phóng to 4x (256x256), cụm 4 nút điều hướng, dropdown chọn hoạt cảnh, thanh trượt FPS và nút Play/Pause.
  - Cột 3: Bảng công cụ thao tác gồm các nút: "Nạp Khung Hình Vào Canvas", "Nạp Hoạt Cảnh Vào Timeline", "Xuất Spritesheet Atlas".
- Đăng ký các sự kiện tương tác chuột mượt mà.

**Các bước thực hiện:**
- [ ] **Bước 4.1:** Tạo file `apps/studio/src/lpc/lpc-studio-modal.ts`.
- [ ] **Bước 4.2:** Thiết kế mã HTML/DOM sinh động và gắn các sự kiện lắng nghe cập nhật `LpcCompositor`.
- [ ] **Bước 4.3:** Bổ sung CSS cho giao diện modal 3 cột trong `apps/studio/index.html` hoặc file CSS tương ứng với giao diện Dark Mode cao cấp.
- [ ] **Bước 4.4:** Kiểm tra biên dịch TypeScript bằng `npx tsc --noEmit`.

---

### Nhiệm Vụ 5: Tích Hợp Vào Toolbar Studio & Kết Nối Toàn Bộ Hệ Thống (`apps/studio/src/main.ts`)

**File chỉnh sửa:**
- `d:\pixel_draw\apps\studio\index.html` (Thêm nút `LPC Studio` trên Header)
- `d:\pixel_draw\apps\studio\src\main.ts` (Kết nối Modal với dự án Canvas hiện hành)

**Các bước thực hiện:**
- [ ] **Bước 5.1:** Bổ sung nút bấm `btn-lpc-studio` trên Header Toolbar cạnh các nút Wizard và Project Assets trong `index.html`.
- [ ] **Bước 5.2:** Trong `main.ts`, import `LpcStudioModal` và khởi tạo kết nối với đối tượng `project` đang mở trên Studio.
- [ ] **Bước 5.3:** Cấu hình tải mặc định file `sprites.png` làm phôi cơ thể ban đầu.
- [ ] **Bước 5.4:** Xử lý sự kiện khi nhấn "Nạp Khung Hình Vào Canvas": Cập nhật layer vào `project.frames[project.activeFrameIndex]`, gọi `renderCanvas()` và `renderLayersUI()`.
- [ ] **Bước 5.5:** Xử lý sự kiện khi nhấn "Nạp Hoạt Cảnh Vào Timeline": Thêm `AnimationClip` vào `project.clips`, chuyển timeline sang clip mới và làm mới giao diện Timeline.
- [ ] **Bước 5.6:** Chạy `npm run build` để kiểm tra độ tương thích và không có lỗi biên dịch trên toàn bộ monorepo.

# Kế Hoạch Triển Khai: Nâng Cấp Hệ Thống LPC Studio Theo Chuẩn Universal LPC Generator

> **Dành cho kỹ sư triển khai:** Kế hoạch này áp dụng các giải pháp kiến trúc được đúc kết từ việc phân tích mã nguồn gốc [Universal-LPC-Spritesheet-Character-Generator](file:///d:/pixel_draw/scratch/lpc-generator).
> Lưu ý các quy tắc bắt buộc của dự án:
> - Không tạo file test tự động theo quy tắc dự án (`Not create file test`). Sử dụng `npm run build` và kiểm tra trực quan trên trình duyệt để nghiệm thu.
> - Không tự động commit git (`Do not auto commit to git`).
> - Toàn bộ chú thích trong code viết bằng tiếng Việt có dấu đầy đủ Unicode UTF-8.
> - Tên biến, hàm, kiểu dữ liệu sử dụng tiếng Anh chuẩn.
> - Tuyệt đối không sử dụng icon hoặc emoji trong mã nguồn và báo cáo.

**Mục tiêu:** Nâng cấp phân hệ LPC Studio của dự án `pixel_draw` để đạt độ chính xác, tính linh hoạt và chất lượng chuẩn mực tương đương Universal LPC Generator, bao gồm: Hoán đổi bảng màu thời gian thực (Palette Recolor), Mặt nạ che khuất màu tím Magenta (#FF2CE6), và Kiểm tra tương thích hành động (Animation Compatibility Filter).

**Kiến trúc:**
- `apps/studio/src/lpc/lpc-palette.ts`: Động cơ đổi màu Palette thời gian thực cho Pixel Art dựa trên bảng màu chuẩn ULPC (da, tóc, vải, da thuộc, kim loại) với dung sai so màu RGB.
- `apps/studio/src/lpc/lpc-compositor.ts`: Tích hợp hàm quét mặt nạ trong suốt màu Magenta (#FF2CE6), kiểm tra cờ tương thích hành động `supportedAnimations` trước khi vẽ layer, và lưu cache ảnh đã đổi màu.
- `apps/studio/src/lpc/lpc-studio-modal.ts`: Bổ sung bảng màu mẫu (Color Swatches) trực quan theo palette chuẩn, giữ nhịp hoạt cảnh chuẩn 8 FPS, và tối ưu hóa tính năng phối đồ ngẫu nhiên dựa trên độ tương thích của hành động.

**Ngăn xếp công nghệ:** TypeScript, HTML5 Canvas 2D API, ImageData Pixel Manipulation, Vite, Vanilla CSS.

---

## Ràng Buộc Toàn Cục

- Hệ tọa độ lưới: 832x3456 pixel, 13 cột x 54 hàng, kích thước ô khung hình 64x64 pixel.
- Mã màu mặt nạ cắt tóc/thân người: Magenta `#FF2CE6` (RGB: 255, 44, 230).
- Tốc độ hoạt cảnh mặc định: 8 FPS (khoảng thời gian 125ms mỗi khung hình theo chuẩn LPC retro).
- Độ mượt đồ họa: Luôn đặt `imageSmoothingEnabled = false` trên toàn bộ Canvas để giữ nguyên độ sắc nét của Pixel Art.

---

## Trọng Tâm Nghiệm Thu (Review Focus)

1. Tốc độ đổi màu: Đổi màu tóc hoặc trang phục phải diễn ra tức thì, không làm giảm tốc độ khung hình (khóa bộ nhớ đệm kết quả đổi màu).
2. Độ nguyên vẹn của Pixel Art: Thuật toán đổi màu palette chỉ thay đổi các sắc độ mục tiêu, không làm biến đổi các pixel đường viền đen (#000000) hay kênh trong suốt (Alpha = 0).
3. Hiệu quả của Mặt nạ Magenta: Khi nhân vật đội mũ kín đầu, toàn bộ các pixel màu `#FF2CE6` phải biến thành trong suốt hoàn toàn, triệt tiêu hiện tượng tóc lòi ra ngoài mũ.
4. Tránh lỗi hình rác khi chọn hành động: Khi nhân vật thực hiện các hành động mở rộng (ngồi nghỉ, leo trèo, nhảy), các trang phục không hỗ trợ hành động đó sẽ được xử lý an toàn (ẩn đi hoặc dùng khung hình tĩnh phù hợp), không bị lệch hàng hay méo mó.
5. Biên dịch sạch: Lệnh `npm run build` chạy thành công không có bất kỳ cảnh báo hoặc lỗi kiểu dữ liệu nào.

---

### Nhiệm Vụ 1: Xây Dựng Động Cơ Đổi Màu Bảng Màu Thời Gian Thực (`apps/studio/src/lpc/lpc-palette.ts`)

**File tạo mới:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-palette.ts`

**Giao diện & Chức năng:**
- Định nghĩa các kiểu dữ liệu: `LpcRgb`, `LpcPalettePair`, `LpcPaletteGroup`.
- Xuất các bộ bảng màu chuẩn của Universal LPC:
  - Bảng màu tóc (`LPC_HAIR_PALETTES`): Vàng sáng (Blonde), Nâu hạt dẻ (Brown), Đen tuyền (Black), Đỏ hung (Red), Bạc trắng (Silver), Xanh lam (Blue), Tím (Purple), Hồng (Pink), Lục bảo (Green).
  - Bảng màu da (`LPC_SKIN_PALETTES`): Da trắng sáng (Light), Da rám nắng (Tanned), Da ngăm (Dark), Da quỷ dạ xoa (Orc Green), Da bóng ma (Pale Ghost).
  - Bảng màu trang phục vải (`LPC_CLOTH_PALETTES`): Trắng, Đen, Đỏ đô, Xanh hoàng gia, Xanh rêu, Vàng đất.
- Hàm `hexToRgb(hex: string): LpcRgb | null`: Chuyển đổi mã màu HEX sang RGB.
- Hàm `buildColorMap(sourceHexList: string[], targetHexList: string[]): LpcPalettePair[]`: Xây dựng cặp ánh xạ độ bóng sáng - tối.
- Hàm `recolorCanvasWithPalette(sourceCanvas: HTMLCanvasElement | ImageBitmap, colorPairs: LpcPalettePair[], tolerance?: number): HTMLCanvasElement`: Quét qua `ImageData` và thay thế các dải màu với dung sai `tolerance = 1`.

**Các bước thực hiện:**
- [x] **Bước 1.1:** Tạo file `apps/studio/src/lpc/lpc-palette.ts`.
- [x] **Bước 1.2:** Định nghĩa các hằng số bảng màu chuẩn Universal LPC (mỗi palette gồm danh sách từ 5 đến 8 mã màu từ vùng tối đến vùng sáng nhất).
- [x] **Bước 1.3:** Viết hàm `recolorCanvasWithPalette` thao tác trên pixel buffer `Uint8ClampedArray` với kiểm tra điều kiện kênh Alpha > 0 và độ lệch dung sai RGB.
- [x] **Bước 1.4:** Viết hàm tiện ích tạo bộ nhớ đệm `createRecolorCacheKey` để tránh tính toán lại ảnh khi người dùng không thay đổi màu.
- [x] **Bước 1.5:** Kiểm tra cú pháp bằng lệnh `npx tsc --noEmit`.

---

### Nhiệm Vụ 2: Tích Hợp Mặt Nạ Magenta Và Lọc Tương Thích Hoạt Cảnh Vào Compositor (`apps/studio/src/lpc/lpc-compositor.ts`)

**File chỉnh sửa:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-compositor.ts`

**Giao diện & Chức năng:**
- Bổ sung hàm `applyTransparencyMask(ctx: CanvasRenderingContext2D, width: number, height: number): void`: Quét toàn bộ canvas khung hình và đưa kênh Alpha về 0 cho tất cả pixel có màu RGB xấp xỉ `(255, 44, 230)`.
- Mở rộng giao diện `LpcAssetItem`:
  - Thêm trường tùy chọn `supportedAnimations?: string[]`.
  - Thêm trường tùy chọn `paletteGroup?: string`.
  - Thêm trường tùy chọn `selectedPaletteHex?: string[]`.
- Cập nhật hàm `renderCurrentFrame`:
  - Trước khi vẽ từng layer, kiểm tra nếu `layer.supportedAnimations` được khai báo nhưng không chứa `currentAction.id`, thì bỏ qua hoặc chuyển sang chế độ an toàn.
  - Sau khi vẽ layer mũ hoặc giáp kín, gọi `applyTransparencyMask` nếu layer có đánh dấu chứa mặt nạ.
  - Sử dụng ảnh đã được đổi màu qua module `lpc-palette.ts` trước khi gọi `ctx.drawImage`.

**Các bước thực hiện:**
- [x] **Bước 2.1:** Thêm hàm `applyTransparencyMask` vào `lpc-compositor.ts` với chú thích tiếng Việt có dấu.
- [x] **Bước 2.2:** Tích hợp `recolorCanvasWithPalette` vào quy trình vẽ layer của `LpcCompositor`.
- [x] **Bước 2.3:** Bổ sung điều kiện kiểm tra tính tương thích của hành động trước khi bóc tách ô khung hình của layer.
- [x] **Bước 2.4:** Kiểm tra biên dịch bằng `npx tsc --noEmit`.

---

### Nhiệm Vụ 3: Nâng Cấp Giao Diện Bảng Màu Và Điều Khiển Tương Tác (`apps/studio/src/lpc/lpc-studio-modal.ts`)

**File chỉnh sửa:**
- `d:\pixel_draw\apps\studio\src\lpc\lpc-studio-modal.ts`

**Giao diện & Chức năng:**
- Bổ sung thanh chọn bảng màu nhanh (Palette Swatches) dưới mục chọn màu tùy chỉnh:
  - Hiển thị các khối màu đại diện cho kiểu tóc (Vàng, Nâu, Đen, Đỏ, Trắng, Tím, v.v.).
  - Hiển thị các khối màu cho trang phục và màu da.
- Đảm bảo thanh điều khiển FPS chạy chuẩn 8 FPS theo mặc định của Universal LPC, cho phép người dùng tùy chỉnh từ 1 đến 24 FPS.
- Cập nhật logic `randomizeCharacter()`:
  - Khi người dùng đang ở hành động mở rộng (ví dụ: `climb` hoặc `sit`), ưu tiên chọn các phụ kiện có đầy đủ hoạt cảnh đó, giúp nhân vật ngẫu nhiên luôn ăn khớp hoàn hảo.

**Các bước thực hiện:**
- [x] **Bước 3.1:** Chỉnh sửa giao diện cột bên trái trong `lpc-studio-modal.ts` để hiển thị hàng nút màu Swatch cho tóc và trang phục.
- [x] **Bước 3.2:** Bắt sự kiện khi người dùng nhấn vào nút màu Swatch, kích hoạt bộ đổi màu của `LpcCompositor` và vẽ lại ngay lập tức.
- [x] **Bước 3.3:** Tinh chỉnh hàm `randomizeCharacter` để lọc trang phục thông minh theo hành động hiện tại.
- [x] **Bước 3.4:** Kiểm tra biên dịch bằng `npm run build`.

---

### Nhiệm Vụ 4: Nghiệm Thu Thực Nghiệm Trực Quan Trên Trình Duyệt

**Mục tiêu kiểm thử:**
- Khởi động dev server và kiểm tra giao diện trên trình duyệt tại `http://localhost:5173/`.
- Kiểm tra tính năng đổi màu tóc sang các màu Vàng, Đen, Nâu, Đỏ, Bạc xem các đường bóng đổ và pixel viền có sắc nét hay không.
- Kiểm tra toàn bộ 9 hành động mở rộng (Sit, Climb, Idle, Jump, Emote, Run, Combat Idle, Backslash, Halfslash) khi đổi màu và phối đồ ngẫu nhiên.
- Kiểm tra tính năng xuất khung hình sang Timeline Studio.

**Các bước thực hiện:**
- [x] **Bước 4.1:** Mở trình duyệt và kiểm tra giao diện LPC Studio Modal.
- [x] **Bước 4.2:** Kiểm tra đổi màu tóc và màu da qua các palette chuẩn Universal LPC.
- [x] **Bước 4.3:** Kiểm tra phối đồ ngẫu nhiên và chuyển đổi giữa các hành động.
- [x] **Bước 4.4:** Xác nhận không có lỗi Console trên trình duyệt và chụp ảnh nghiệm thu.

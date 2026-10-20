# Đặc Tả Kỹ Thuật: Bộ Công Cụ Photoshop, Cơ Chế Lưu Trữ Dự Án Toàn Vẹn và Tối Ưu Giao Diện Studio

- Ngày tạo: 2026-10-20
- Tác giả: Antigravity & Pair Programming Partner
- Trạng thái: Đã thống nhất thiết kế (Approved)
- Dự án: Pixel Draw Studio & Local Hub

---

## 1. Tổng Quan Mục Tiêu

Hệ thống Pixel Art Studio hiện tại đã phát triển mạnh mẽ về tính năng vẽ cơ bản, MCP Bridge và tích hợp AI LoRA. Tuy nhiên, còn tồn tại 4 vấn đề lớn đối với trải nghiệm người dùng đồ họa chuyên nghiệp:
1. **Thiếu công cụ chọn vùng nhanh và chỉnh màu chuẩn Photoshop**: Hiện chỉ có vùng chọn hình chữ nhật đơn giản, chưa có cây đũa thần (Magic Wand) chọn theo màu sắc/mảng liền kề, và chưa có bộ công cụ cân chỉnh màu sắc điểm ảnh (Hue/Saturation/Lightness, Brightness/Contrast, Replace Color, Invert).
2. **Cơ chế lưu trữ bị gộp chung**: Người dùng mở ảnh trong kho hoặc vẽ nhưng chưa có sự phân tách rõ rệt giữa việc "Lưu dự án làm việc dạng đa layer/frame như file .PSD" và "Xuất file ảnh thành phẩm (PNG, SpriteSheet, GIF)".
3. **Kho Lưu Trữ (Gallery) khó tìm kiếm và sắp xếp**: Toàn bộ ảnh sinh ra bởi AI và ảnh vẽ tay bị dồn vào một lưới đơn thuần, thiếu bộ lọc phân loại theo dự án, thiếu ô tìm kiếm và thiếu công cụ sắp xếp.
4. **Thanh Headbar bị trải dài và tràn viền**: Toàn bộ hơn 14 nút bấm chức năng (Undo, Redo, Flip H, Flip V, Rot 90, Grid, Pivot, Sym X, Bridge, Import, Kho Ảnh, Lưu Kho, AI Studio, Export) nằm dàn hàng ngang gây chật chội và kém thẩm mỹ.

Tài liệu này đặc tả kiến trúc kỹ thuật toàn diện để giải quyết triệt để 4 vấn đề trên.

---

## 2. Kiến Trúc Chi Tiết

### 2.1. Tái Cấu Trúc Thanh Headbar và Hệ Thống Menu Thả Xuống (Dropdown System)

#### Cấu trúc 3 phân vùng:
1. **Khu vực Thương hiệu & Thông số (Trái)**:
   - Logo / Tên: `Pixel Studio`.
   - Nút kích thước Canvas: `canvas-size-badge` (click để mở bảng đổi kích thước).
   - Nút thu phóng: `canvas-zoom-badge` (click để đặt lại 100% hoặc căn giữa).
2. **Khu vực Menu Thả Xuống Chuẩn Phần Mềm Đồ Họa (Giữa)**:
   - **Tệp (File)**:
     - `Dự án mới (New Project)`: Đặt lại canvas về 24x24 px mặc định, làm mới layer và frame.
     - `Mở file .pxdraw từ máy (Open Project)`: Nạp file `.pxdraw` từ máy tính.
     - `Lưu file .pxdraw về máy (Save Project)`: Tải xuống file `.pxdraw` đóng gói toàn bộ trạng thái.
     - `Lưu vào Kho (Save to Gallery)`: Đồng bộ dự án lên kho lưu trữ của Server.
     - `Nhập ảnh (Import Image)`: Mở input tải ảnh từ máy tính.
     - `Xuất file ảnh (Export Image/Sprite)`: Mở modal xuất ảnh chuyên sâu.
   - **Chỉnh sửa (Edit)**:
     - `Hoàn tác (Undo)`: Phím tắt `Ctrl+Z`.
     - `Làm lại (Redo)`: Phím tắt `Ctrl+Y`.
     - `Lật ngang (Flip Horizontal)`: Lật layer hoặc vùng chọn theo trục ngang.
     - `Lật dọc (Flip Vertical)`: Lật layer hoặc vùng chọn theo trục dọc.
     - `Xoay 90 độ (Rotate 90°)`: Xoay layer hoặc vùng chọn 90 độ theo chiều kim đồng hồ.
     - `Đổi kích cỡ Canvas (Canvas Size)`: Mở hộp thoại Canvas Resize & Anchor.
   - **Màu sắc (Adjustments)**:
     - `Sắc độ / Độ bão hòa / Độ sáng (Hue/Sat/Lightness)`: Phím tắt `Ctrl+U`.
     - `Độ sáng & Độ tương phản (Brightness/Contrast)`.
     - `Thay thế màu (Color Replace / Palette Swap)`.
     - `Đảo màu (Invert Colors)`.
   - **Hiển thị (View)**:
     - `Lưới Pixel (Grid)`: Bật/tắt đường lưới.
     - `Điểm neo (Pivot)`: Bật/tắt tâm xoay và neo vị trí.
     - `Đối xứng ngang (Symmetry X)`: Bật/tắt vẽ đối xứng.
     - `Onion Skinning`: Bật/tắt hiển thị bóng mờ frame trước/sau.
3. **Khu vực Tác Vụ Nhanh & Trạng Thái (Phải)**:
   - `Đèn trạng thái MCP Bridge`: Chấm tròn đổi màu kèm nhãn thu gọn.
   - `Nút Kho Ảnh (Gallery)`: Mở cửa sổ quản lý kho lưu trữ.
   - `Nút AI Studio`: Mở bảng điều khiển sinh ảnh bằng AI LoRA.
   - `Nút Xuất File (Export)`: Nút chính nổi bật (Primary Action Button).

---

### 2.2. Bộ Công Cụ Chọn Vùng Nhanh & Chỉnh Màu Phong Cách Photoshop

#### 1. Cây Đũa Thần (Magic Wand Tool):
- **Phím tắt**: `W`.
- **Mở rộng SelectionManager**:
  - Bổ sung cấu trúc dữ liệu `selectedPixelKeys: Set<string>` (tập hợp các tọa độ `x,y` được chọn).
  - Thuật toán `floodFillSelect(startX, startY, contiguous, tolerance)`:
    - Nếu `contiguous === true`: Duyệt loang 4 hướng bắt đầu từ điểm click, so khớp màu gốc với các điểm lân cận.
    - Nếu `contiguous === false`: Duyệt qua toàn bộ tọa độ trên Layer hiện tại, thêm vào vùng chọn bất kỳ pixel nào có sai biệt màu nhỏ hơn hoặc bằng dung sai `tolerance`.
  - Công thức tính khoảng cách màu sắc Euclidean:
    `distance = sqrt((R1 - R2)^2 + (G1 - G2)^2 + (B1 - B2)^2) / sqrt(255^2 * 3) * 100`
- **Render viền Marching Ants**:
  - Vẽ đường viền đứt nét xung quanh các pixel được chọn trong vòng lặp render canvas.
- **Hành động với vùng chọn**:
  - Tích hợp liền mạch với công cụ `Move` (nhấc cụm pixel nổi), `Delete` (xóa pixel được chọn), `Ctrl+C` / `Ctrl+V`.

#### 2. Hộp Thoại Chỉnh Màu Đa Năng (Color Adjustments Modal):
- **Đường dẫn file**: `apps/studio/src/tools/color-adjustments.ts` và template giao diện trong `index.html`.
- **Các chức năng chính**:
  1. *Chuyển đổi HSL*:
     - Hàm `rgbToHsl(r, g, b)` và `hslToRgb(h, s, l)`.
     - Thanh trượt Hue (-180° đến +180°), Saturation (-100% đến +100%), Lightness (-100% đến +100%).
  2. *Thay thế màu (Color Replace)*:
     - Chọn `Color From` và `Color To`.
     - Tự động thay thế toàn bộ điểm ảnh có màu nguồn sang màu đích.
  3. *Độ sáng & Độ tương phản*:
     - Thanh trượt Brightness (-100 đến +100) và Contrast (-100 đến +100).
  4. *Đảo màu (Invert Colors)*:
     - Biến đổi RGB thành `(255 - R, 255 - G, 255 - B)`.
- **Xem trước trực tiếp (Live Preview)**:
  - Cho phép người dùng nhìn thấy sự thay đổi tức thì trên Canvas.
  - Ghi nhận thay đổi vào `HistoryManager` khi nhấn Áp Dụng để hỗ trợ hoàn tác Undo/Redo.

---

### 2.3. Cơ Chế Lưu Trữ Dự Án Toàn Vẹn (.pxdraw) & Hộp Thoại Xuất Ảnh

#### 1. Định Dạng File Dự Án `.pxdraw`:
```typescript
export interface PxDrawProjectFile {
  version: '2.0';
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  activeFrameIndex: number;
  activeLayerId: string;
  frames: {
    id: string;
    name: string;
    durationMs: number;
    layers: {
      id: string;
      name: string;
      visible: boolean;
      opacity: number;
      blendMode: string;
      pixels: Record<string, string>; // coordToKey -> hex color
    }[];
  }[];
  clips: {
    id: string;
    name: string;
    frameIndices: number[];
    fps: number;
    loop: boolean;
  }[];
  palette?: {
    id: string;
    colors: string[];
  };
}
```

#### 2. Luồng Tương Tác:
- **Tải file `.pxdraw` về máy**: Sinh URL Blob từ nội dung JSON và kích hoạt download qua thẻ `<a download="ten_du_an.pxdraw">`.
- **Mở file `.pxdraw` từ máy**: Sử dụng `FileReader` đọc file, kiểm tra tính hợp lệ của cấu trúc `frames` và `layers`, sau đó nạp trực tiếp vào `CanvasEngine` và cập nhật lại giao diện.
- **Lưu vào Kho Lưu Trữ**: Gửi toàn bộ cấu trúc dự án lên endpoint `/api/gallery/save`, máy chủ ghi nhận file `.pxdraw` kèm ảnh PNG thumbnail.

#### 3. Hộp Thoại Xuất Ảnh Chuyên Nghiệp (Export Modal):
- **Tab 1: Xuất Ảnh Đơn Lẻ (Single PNG)**:
  - Chọn tỷ lệ phóng to: 1x, 2x, 4x, 8x, 16x.
  - Chọn nền trong suốt hoặc nền màu tùy chọn.
- **Tab 2: Xuất Sprite Sheet**:
  - Bố cục: Dải ngang (Horizontal Strip), Dải dọc (Vertical Strip), hoặc Dạng lưới (Grid với số cột tùy chỉnh).
  - Khoảng cách đệm giữa các frame: 0px, 1px, 2px.
  - Tùy chọn tải kèm file JSON Atlas tọa độ khung hình.
- **Tab 3: Xuất Hoạt Ảnh GIF**:
  - Đóng gói chuỗi khung hình thành file GIF động với FPS điều chỉnh được.

---

### 2.4. Nâng Cấp Kho Ảnh (Gallery 2.0)

#### 1. Bộ Lọc Danh Mục (Filter Tabs):
- `Tất cả`: Hiển thị toàn bộ tác phẩm.
- `Dự Án (.pxdraw)`: Chỉ hiển thị tác phẩm có lưu dữ liệu đa frame/layer.
- `Sprite Hoạt Cảnh`: Tác phẩm có từ 2 frame trở lên.
- `AI Pixel Art`: Tác phẩm sinh ra từ các mô hình AI.

#### 2. Tìm Kiếm & Sắp Xếp:
- `Ô tìm kiếm`: Lọc trực tiếp theo tên tác phẩm hoặc prompt.
- `Bộ sắp xếp`:
  - Mới nhất (Newest).
  - Cũ nhất (Oldest).
  - Theo tên A-Z (Alphabetical).

#### 3. Thẻ Tác Phẩm Thông Minh (Smart Artwork Card):
- Hiển thị rõ số lượng frames và layers (`Dự Án • 4F • 3L`).
- Nút tác vụ riêng biệt:
  - Với Dự án: `Mở Dự Án` (nạp trọn vẹn), `Tải .pxdraw`, `Xuất Ảnh`, `Xóa`.
  - Với Ảnh đơn / AI: `Nạp Canvas`, `Tải PNG`, `Xóa`.

---

## 3. Kế Hoạch Triển Khai Chi Tiết

1. **Giai đoạn 1**: Tái cấu trúc thanh Headbar, triển khai hệ thống Dropdown Menu và làm gọn các nút tác vụ.
2. **Giai đoạn 2**: Xây dựng thuật toán Magic Wand (Cây đũa thần) và nâng cấp SelectionManager hỗ trợ mặt nạ pixel không theo hình chữ nhật.
3. **Giai đoạn 3**: Xây dựng module và hộp thoại Chỉnh Màu Đa Năng (HSL, Replace Color, Brightness/Contrast, Invert).
4. **Giai đoạn 4**: Xây dựng cơ chế xuất nhập file dự án `.pxdraw` và hộp thoại Xuất Ảnh (Smart Export Modal).
5. **Giai đoạn 5**: Nâng cấp giao diện Kho Ảnh (Gallery 2.0) với đầy đủ Tabs, Tìm kiếm, Sắp xếp và nút thao tác phân loại.
6. **Giai đoạn 6**: Kiểm thử toàn diện và xác thực trải nghiệm người dùng.

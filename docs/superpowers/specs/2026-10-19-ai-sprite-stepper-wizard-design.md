# Đặc Tả Thiết Kế: AI Sprite Stepper Wizard & Hệ Thống Sao Lưu Trạng Thái (State Checkpoint)

Ngày: 2026-10-19
Trạng thái: Đã phê duyệt thiết kế

---

## 1. Tổng Quan & Mục Tiêu

Hệ thống AI Studio trước đây có hai tab tách biệt ("Ảnh Tĩnh" và "Tạo Hoạt Ảnh Sprite"). Việc phân tách này gây ra sự rời rạc trong trải nghiệm người dùng (UX): Tab Hoạt Ảnh bị thiếu bảng nhặt tag và trợ lý Gemini, thiếu ô nhập mô tả trực quan, và khi gặp sự cố mạng hoặc chuyển bước dễ bị mất dữ liệu đã cấu hình.

Mục tiêu của bản thiết kế này là:
1. **Hợp nhất thành luồng làm việc theo bước (4-Step Stepper Wizard)**:
   - Thay thế thanh chuyển tab cũ bằng thanh điều hướng tiến trình 4 bước mạch lạc.
   - Dùng chung toàn bộ sức mạnh của Bảng Nhặt Tag Chủ Đề, Trợ lý Gemini Flash tiếng Việt và các thẻ chọn nhanh Preset từ tab Ảnh Tĩnh.
2. **Cơ chế sao lưu trạng thái từng bước (State Checkpoint & Backup)**:
   - Tự động lưu toàn bộ dữ liệu ở mỗi bước vào `localStorage` và bộ nhớ tạm.
   - Cho phép người dùng chuyển qua lại tự do giữa các bước (Quay lại / Tiếp tục) mà không bao giờ bị mất prompt, tag hay ảnh đã tạo.
   - Tự động phục hồi phiên làm việc cũ khi tải lại trang và cung cấp nút Làm mới (Reset) để xóa trắng khi cần.
3. **Khả năng chống lỗi (Fault Tolerance)**:
   - Khi API sinh ảnh bị gián đoạn hoặc lỗi máy chủ, hệ thống giữ nguyên 100% dữ liệu của bước hiện tại và hiển thị nút "Thử lại (Retry)", không bắt người dùng phải quay lại từ Bước 1.

---

## 2. Kiến Trúc Giao Diện 4 Bước (Stepper Wizard)

### 2.1 Thanh điều hướng tiến trình (Stepper Header)
Đặt ở đầu modal AI Studio với 4 chỉ số bước rõ ràng:
- **Bước 1: Thiết kế nhân vật (Character Creator)**
- **Bước 2: Xem trước & Chốt mẫu (Base Review & Lock)**
- **Bước 3: Cấu hình hoạt cảnh (Action & Frames)**
- **Bước 4: Sinh hoạt ảnh & Xem thử (Generate & Preview)**

Mỗi chỉ số bước thể hiện trạng thái: `completed` (đã hoàn thành, viền xanh lá), `active` (đang thực hiện, viền sáng cyan), `pending` (chưa tới, mờ nhẹ). Người dùng có thể bấm vào các bước đã hoàn thành để quay lại xem hoặc điều chỉnh.

### 2.2 Chi tiết từng bước

#### Bước 1: Thiết kế nhân vật mẫu (Character Creator)
- **Bố cục 2 cột tiêu chuẩn**:
  - **Cột trái**: Bảng Nhặt Tag Chủ Đề (Tag Picker Scroll) với hơn 9 danh mục tag, ô tìm kiếm tag nhanh và nút xóa tag.
  - **Cột phải**:
    - Khung Trợ lý Gemini Flash tiếng Việt (nhập mô tả tự nhiên bằng tiếng Việt -> tự động tạo tag).
    - Các thẻ chọn nhanh phong cách 1-Click Preset (Hiệp sĩ kiếm vàng, Pháp sư nguyên tố, Ninja bóng đêm, Cung thủ rừng, Nữ chiến binh, Quái Slime...).
    - Ô Textarea hiển thị Prompt chi tiết đồng bộ hai chiều với các thẻ Tag.
    - Bảng tùy chọn nâng cao (Checkpoint, LoRA, LoRA Scale, Steps).
- **Nút điều hướng**:
  - Nút **"Vẽ Mẫu Ban Đầu"** (Sinh 1 ảnh toàn thân đứng chuẩn với `standing, full body`).
  - Khi đã sinh xong ảnh, nút **"Tiếp tục sang Bước 2"** được kích hoạt.

#### Bước 2: Xem trước & Chốt mẫu nhân vật (Base Review & Lock)
- **Khung xem trước ảnh mẫu**:
  - Khung hình vuông caro pixel art lớn, hiển thị ảnh ở kích thước phóng to 140x140 px sắc nét (image-rendering: pixelated).
  - Thông tin Seed thực tế (ví dụ: `Seed: #1417382643`).
  - Badge trạng thái: `Chưa chốt mẫu (Xem trước)` hoặc `Đã chốt mẫu #Seed`.
- **Các nút hành động**:
  - **"Quay lại Bước 1"**: Để bổ sung tag hoặc sửa prompt mà không mất dữ liệu.
  - **"Vẽ Lại (Reroll)"**: Tự động sinh lại ảnh mới với Seed ngẫu nhiên khác nhưng giữ nguyên prompt.
  - **"Chốt Mẫu Này"**: Khóa cứng Seed, hiển thị viền phát sáng màu xanh lá và tự động chuyển sang Bước 3.

#### Bước 3: Cấu hình hoạt cảnh (Animation Setup)
- **Lưới 7 thẻ hành động (Action Cards)**:
  - Đi bộ (Walk) - 4 frames
  - Tấn công (Attack) - 4 frames
  - Đứng yên (Idle) - 4 frames
  - Ngồi nghỉ (Sit) - 2 frames
  - Nằm gục (Defeated) - 2 frames
  - Chạy nhanh (Run) - 4 frames
  - Nhảy (Jump) - 3 frames
- **Bộ chọn số khung hình (Frame Chips)**: 2, 3, 4, 6, 8 frames (tự động đồng bộ gợi ý khi chọn hành động).
- **Tùy chọn bổ sung**:
  - Cỡ mỗi frame: 64x64, 48x48, 32x32 px.
  - Checkbox tự động tách nền trong suốt an toàn (Safe background removal).
- **Nút điều hướng**:
  - Nút **"Quay lại Bước 2"**.
  - Nút **"Bắt Đầu Tạo Hoạt Ảnh"** (Chuyển sang Bước 4 và gọi API).

#### Bước 4: Sinh hoạt ảnh & Xem thử (Generate & Preview)
- **Hộp tiến trình thời gian thực**:
  - Hiển thị chi tiết từng giai đoạn: Khởi động -> Khử nhiễu SD1.5 từng bước (1/18 -> 18/18) -> Bóc tách frames con -> Tách nền an toàn.
  - Thanh tiến trình, thời gian đã chạy và thời gian còn lại dự kiến (ETA).
- **Khung xem trước hoạt cảnh (Live Animation Player)**:
  - Khi AI sinh xong N frames, bộ phát tự động chạy lặp (loop) hoạt ảnh ngay bên trong modal để người dùng đánh giá chuyển động trước khi đưa vào Canvas.
- **Nút điều hướng**:
  - Nút **"Vẽ lại hành động khác"** (Trở về Bước 3 giữ nguyên nhân vật).
  - Nút **"Nạp Vào Timeline Studio"**: Đóng modal, tạo các frame trên Timeline chính, tạo đối tượng AnimationClip và kích hoạt Preview Player trên Studio.

---

## 3. Cơ Chế Sao Lưu Trạng Thái (State Checkpoint & Backup System)

### 3.1 Cấu trúc dữ liệu Checkpoint (`AiWizardCheckpoint`)
```typescript
interface AiWizardCheckpoint {
  step: 1 | 2 | 3 | 4;
  prompt: string;
  activeTags: string[];
  checkpointModel: string;
  loraModel: string;
  loraScale: number;
  steps: number;
  size: number;
  removeBg: boolean;
  baseCharacter: {
    seed: number | null;
    locked: boolean;
    pixels: PixelPoint[] | null;
    width: number;
    height: number;
    dataUrl: string | null;
  };
  animation: {
    action: string;
    frameCount: number;
    frameSize: number;
    generatedFrames: {
      frameIndex: number;
      width: number;
      height: number;
      pixels: PixelPoint[];
    }[] | null;
  };
  updatedAt: number;
}
```

### 3.2 Quy trình sao lưu & phục hồi
1. **Lưu tự động (Auto-save)**:
   - Sau mỗi thao tác nhập prompt, chọn tag, sinh ảnh mẫu, chốt seed, hoặc chọn hành động, hàm `saveWizardCheckpoint()` sẽ đồng bộ toàn bộ trạng thái vào `localStorage.setItem('pixel_draw_ai_wizard_checkpoint', JSON.stringify(checkpoint))`.
2. **Khôi phục phiên (Session Restore)**:
   - Khi mở modal AI Studio, hàm `loadWizardCheckpoint()` kiểm tra nếu có checkpoint hợp lệ trong vòng 24 giờ sẽ tự động phục hồi các giá trị, hiển thị ảnh mẫu đã sinh (nếu có) và đưa người dùng về đúng bước hiện tại.
3. **Nút Làm mới (Reset)**:
   - Bổ sung nút "Làm mới từ đầu (Reset)" ở góc modal để người dùng chủ động xóa sạch checkpoint nếu muốn tạo nhân vật hoàn toàn mới.
4. **Xử lý ngoại lệ (Error Handling)**:
   - Khi gọi API `/api/ai/generate` hoặc `/api/ai/generate-animation` bị thất bại (timeout, lỗi server), trạng thái modal không bị reset về Bước 1. Modal giữ nguyên bước hiện tại, giữ nguyên prompt và ảnh mẫu, hiển thị thông báo lỗi rõ ràng và hiện nút "Thử lại (Retry)".

---

## 4. Kế Hoạch Triển Khai & Tập Tin Tác Động

### 4.1 Các file cần chỉnh sửa:
1. `apps/studio/index.html`:
   - Thay thế thanh tab cũ bằng Stepper Bar (4 bước).
   - Cấu trúc lại `modal-body` thành 4 panel tương ứng với 4 bước.
   - Bổ sung khung xem trước hoạt ảnh trong Bước 4.
2. `apps/studio/styles/main.css`:
   - Định dạng cho Stepper Header (`.ai-stepper-bar`, `.ai-stepper-item`, `.ai-stepper-line`).
   - Định dạng cho các panel bước (`.wizard-step-panel`).
   - Định dạng cho khung xem trước hoạt ảnh trực tiếp (live animation player).
3. `apps/studio/src/main.ts`:
   - Xây dựng `WizardStateManager` quản lý việc chuyển bước, kiểm tra hợp lệ và lưu/phục hồi checkpoint từ `localStorage`.
   - Gắn sự kiện điều hướng (Next, Back, Reroll, Reset).
   - Kết nối endpoint `/api/ai/generate` ở Bước 1 và `/api/ai/generate-animation` ở Bước 3-4.

### 4.2 Ràng buộc tuân thủ:
- Không tạo file test tự động.
- Không sử dụng emoji hoặc icon.
- Sử dụng tiếng Anh cho tên biến, hàm, interface.
- Luôn giải thích và chú thích mã nguồn bằng tiếng Việt có dấu.
- Không tự động commit git.

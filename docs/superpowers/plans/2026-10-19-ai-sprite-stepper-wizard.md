# Kế Hoạch Triển Khai: AI Sprite Stepper Wizard & State Checkpoint System

> **Dành cho kỹ sư triển khai:** Sử dụng quy trình từng bước có kiểm tra xác thực. Các bước theo dõi bằng cú pháp ô đánh dấu (`- [ ]`).

**Mục tiêu:** Xây dựng lại giao diện AI Studio thành quy trình 4 bước (Stepper Wizard 1 -> 2 -> 3 -> 4) dùng chung toàn bộ bảng Tag và trợ lý Gemini, kèm cơ chế tự động sao lưu trạng thái (Checkpoint) ở mỗi bước để chống mất dữ liệu khi gặp sự cố.

**Kiến trúc:** 
- Giao diện chuyển đổi từ dạng 2 Tab sang Stepper Wizard 4 bước: Thiết kế nhân vật -> Xem trước & Chốt mẫu -> Cấu hình hoạt cảnh -> Sinh hoạt ảnh & Xem thử.
- Trình quản lý trạng thái `WizardStateManager` tự động lưu trữ dữ liệu vào `localStorage` sau mỗi bước, cho phép chuyển qua lại (Back/Next) an toàn 100%.
- Tích hợp Live Animation Player ngay ở Bước 4 để xem trước chuyển động lặp trước khi nạp vào Timeline chính của Studio.

**Công nghệ:** HTML5, Vanilla CSS, TypeScript, Vite, Canvas API, LocalStorage API, FastAPI/Python SD 1.5 LoRA Bridge.

**Tài liệu đặc tả:** [docs/superpowers/specs/2026-10-19-ai-sprite-stepper-wizard-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-19-ai-sprite-stepper-wizard-design.md)

## Ràng Buộc Toàn Cục

- Tuyệt đối không tạo file test tự động theo quy định người dùng (`Not create file test`).
- Không tự động commit git (`Do not auto commit to git`).
- Tên biến, hàm, interface viết bằng tiếng Anh chuẩn (`Use English to name the value`).
- Toàn bộ câu trả lời và chú thích mã nguồn phải là tiếng Việt có dấu (`Alway answer in Vietnamese`, `Alway comment code in Vietnamese`).
- Tuyệt đối không dùng icon hoặc emoji (`Do not use icons or emojis`).
- Không sửa file base của Odoo (`Do not write in file #odoo base`).

---

### Nhiệm Vụ 1: Cấu Trúc HTML Stepper Bar & 4 Bảng Điều Khiển Bước

**Tập tin:**
- Chỉnh sửa: `apps/studio/index.html`

**Giao diện & Cấu trúc:**
- Thay thế thanh tab cũ (`#tab-btn-static`, `#tab-btn-animator`) bằng thanh Stepper Bar 4 bước (`.ai-stepper-bar`):
  - Bước 1: Thiết kế nhân vật (`#wizard-step-indicator-1`)
  - Bước 2: Xem trước & Chốt mẫu (`#wizard-step-indicator-2`)
  - Bước 3: Cấu hình hoạt cảnh (`#wizard-step-indicator-3`)
  - Bước 4: Sinh & Xem thử hoạt ảnh (`#wizard-step-indicator-4`)
- Cấu trúc lại `modal-body` thành 4 panel:
  - Panel 1: `#wizard-panel-1` (Bảng nhặt Tag chủ đề bên trái, Gemini Flash tiếng Việt + Presets + Prompt + Tùy chọn nâng cao bên phải).
  - Panel 2: `#wizard-panel-2` (Khung xem trước ảnh mẫu phóng to 140x140 px, thông tin Seed, trạng thái chốt).
  - Panel 3: `#wizard-panel-3` (Lưới 7 thẻ hành động, chọn số frame 2-8, chọn cỡ, tùy chọn tách nền).
  - Panel 4: `#wizard-panel-4` (Hộp tiến trình thời gian thực, khung Live Animation Player chạy loop chuyển động).
- Bổ sung nút "Làm mới (Reset)" ở đầu modal để xóa checkpoint khi muốn bắt đầu lại.
- Cập nhật footer modal với các nút: "Quay lại" (`#btn-wizard-back`), "Tiếp tục" (`#btn-wizard-next`), "Vẽ lại (Reroll)" (`#btn-wizard-reroll`), "Nạp vào Timeline" (`#btn-wizard-finish`).

- [x] **Bước 1: Cập nhật HTML modal AI Studio trong `apps/studio/index.html`**
- [x] **Bước 2: Kiểm tra cú pháp và cấu trúc thẻ đóng/mở trong `apps/studio/index.html`**

---

### Nhiệm Vụ 2: Định Dạng CSS Cho Stepper Bar, Step Panels & Live Player

**Tập tin:**
- Chỉnh sửa: `apps/studio/styles/main.css`

**Định dạng thiết kế:**
- `.ai-stepper-bar`: Thanh tiến trình hiện đại, căn đều 4 bước với đường kẻ nối (`.ai-stepper-line`).
- `.ai-stepper-item`: Vòng tròn số bước và tên bước với 3 trạng thái:
  - `active`: Viền sáng xanh ngọc `#38bdf8`, chữ trắng nổi bật.
  - `completed`: Viền xanh lá `#4ade80`, nền mờ xanh lá.
  - `pending`: Màu chữ mờ `var(--text-muted)`.
- `.wizard-step-panel`: Ẩn/hiện theo bước hiện tại (`display: none` / `display: flex`).
- `.wizard-live-preview-box`: Khung xem trước hoạt ảnh ở Bước 4 với nền caro pixel art, kích thước lớn và bộ đếm frame hiển thị trực quan.
- Tinh chỉnh các nút điều hướng chân modal (Back mờ, Next phát sáng, Finish màu xanh lam neon).

- [x] **Bước 1: Viết mã CSS cho Stepper Bar và các panel trong `apps/studio/styles/main.css`**
- [x] **Bước 2: Xác nhận không có lỗi cú pháp CSS**

---

### Nhiệm Vụ 3: Quản Lý Trạng Thái Sao Lưu & Phục Hồi (WizardStateManager)

**Tập tin:**
- Tạo mới hoặc bổ sung vào: `apps/studio/src/core/wizard-state-manager.ts` (hoặc trực tiếp trong `apps/studio/src/main.ts`)

**Giao diện lập trình:**
- Interface: `AiWizardCheckpoint` lưu toàn bộ trạng thái (bước hiện tại, prompt, activeTags, baseCharacter, animation, timestamp).
- Hàm `saveWizardCheckpoint(state: AiWizardCheckpoint): void`: Lưu vào `localStorage`.
- Hàm `loadWizardCheckpoint(): AiWizardCheckpoint | null`: Đọc từ `localStorage`, kiểm tra tính hợp lệ.
- Hàm `clearWizardCheckpoint(): void`: Xóa dữ liệu sao lưu để làm mới.

- [x] **Bước 1: Khai báo interface `AiWizardCheckpoint` và các phương thức lưu/phục hồi**
- [x] **Bước 2: Kiểm tra logic đọc/ghi an toàn với khối `try/catch` tránh lỗi trình duyệt**

---

### Nhiệm Vụ 4: Tích Hợp Luồng Chuyển Bước & Kết Nối API AI Studio

**Tập tin:**
- Chỉnh sửa: `apps/studio/src/main.ts`

**Logic điều hướng & API:**
- Khởi tạo trạng thái `currentStep` (mặc định 1 hoặc khôi phục từ checkpoint).
- Hàm `goToStep(stepNumber: number)`:
  - Cập nhật hiển thị panel tương ứng.
  - Cập nhật màu sắc các nút trên Stepper Bar.
  - Cập nhật hiển thị các nút điều hướng ở footer.
  - Tự động gọi `saveWizardCheckpoint()`.
- **Bước 1 -> Bước 2**:
  - Khi bấm "Vẽ Mẫu Ban Đầu" hoặc "Tiếp tục": Nếu chưa có ảnh, gọi `/api/ai/generate` với `mode: 'preview_only'`, lấy `pixels` và `seed`.
  - Hiển thị ảnh mẫu sắc nét trong khung xem trước ở Bước 2.
- **Bước 2**:
  - Nút "Vẽ Lại (Reroll)": Sinh ảnh mới với Seed ngẫu nhiên khác nhưng giữ nguyên prompt.
  - Nút "Chốt Mẫu Này": Khóa Seed, chuyển sang Bước 3.
  - Nút "Quay lại Bước 1": Trở về chỉnh sửa prompt/tag mà không mất dữ liệu.
- **Bước 3 -> Bước 4**:
  - Chọn hành động và số frames.
  - Bấm "Bắt Đầu Tạo Hoạt Ảnh": Chuyển sang Bước 4, gọi `/api/ai/generate-animation`.
- **Bước 4**:
  - Nhận mảng N frames từ máy chủ.
  - Tự động khởi chạy Live Animation Player trong modal chạy lặp liên tục các frame để người dùng xem trước.
  - Nút "Nạp Vào Timeline Studio": Nạp N frames vào `project.frames`, tạo `AnimationClip`, cập nhật canvas engine, đóng modal và kích hoạt Preview Player chính của Studio.

- [x] **Bước 1: Cập nhật mã nguồn `apps/studio/src/main.ts` triển khai toàn bộ quy trình 4 bước**
- [x] **Bước 2: Gắn sự kiện nút Reset, Back, Next, Reroll, Finish**
- [x] **Bước 3: Biên dịch kiểm tra TypeScript bằng `npx tsc --noEmit`**

---

### Nhiệm Vụ 5: Kiểm Tra Xác Thực Toàn Diện

**Tập tin:**
- Kiểm tra toàn bộ hệ thống (Server Bridge + Studio Web App).

- [x] **Bước 1: Chạy lệnh `npm run build --prefix apps/studio` để xác nhận không có lỗi đóng gói**
- [x] **Bước 2: Sử dụng trình duyệt kiểm tra luồng 4 bước từ chọn tag, vẽ mẫu, chốt seed, sinh hoạt cảnh đến nạp vào Timeline**
- [x] **Bước 3: Thử nghiệm tải lại trang để xác nhận dữ liệu checkpoint được phục hồi nguyên vẹn**

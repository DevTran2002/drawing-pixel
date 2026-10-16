# Kế hoạch triển khai: Trợ lý AI Gemini Flash & Bảng nhặt Tag trực quan cho Pixel Draw

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trợ lý Google Gemini Flash tự động chuyển đổi mô tả tự nhiên thành Danbooru tags kèm Bảng nhặt Tag trực quan theo chủ đề với bố cục 2 cột cho Pixel Art AI Studio.

**Architecture:** Tạo module `gemini-helper.ts` gọi Google Gemini REST API v1beta với System Instruction nhúng từ điển tag, thêm endpoint `POST /api/ai/gemini-prompt` trong backend server, và tái cấu trúc giao diện modal AI Studio thành 2 cột với Tag Picker đồng bộ 2 chiều.

**Tech Stack:** TypeScript, Node.js (Fetch API), Google Gemini REST API v1beta, HTML5, CSS Grid/Flexbox, Vite.

**Spec:** [docs/superpowers/specs/2026-10-16-gemini-prompt-assistant-and-tag-picker-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-16-gemini-prompt-assistant-and-tag-picker-design.md)

## Global Constraints
- Không tạo file test tự động theo quy tắc bắt buộc của dự án.
- Không tự động commit git.
- Toàn bộ bình luận mã nguồn và tài liệu viết bằng tiếng Việt.
- Không sử dụng biểu tượng cảm xúc hoặc emoji trong mã nguồn và giao diện.
- Định danh hàm, biến, lớp và đối tượng sử dụng tiếng Anh chuẩn.

---

### Task 1: Xây dựng module kết nối Google Gemini REST API (`apps/server/src/gemini-helper.ts`)

**Files:**
- Create: `apps/server/src/gemini-helper.ts`
- Reference: `docs/pixel_art_tags_dictionary.json`

**Interfaces:**
- Produces: `expandPromptWithGemini(description: string, modelName: string, userApiKey?: string): Promise<{ prompt: string; tags: string[] }>`

- [ ] **Step 1: Tạo file `apps/server/src/gemini-helper.ts`**
  Đọc file `docs/pixel_art_tags_dictionary.json` để nhúng danh mục tag vào System Instruction, gọi Gemini 1.5 Flash API qua endpoint REST `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=...`.
- [ ] **Step 2: Kiểm tra biên dịch TypeScript**
  Run: `npm run build --prefix apps/server`
  Expected: Mã thoát 0, không có lỗi kiểu dữ liệu.

---

### Task 2: Tích hợp endpoint `POST /api/ai/gemini-prompt` trong Backend Server

**Files:**
- Modify: `apps/server/src/server.ts`

**Interfaces:**
- Consumes: `expandPromptWithGemini` từ `apps/server/src/gemini-helper.ts`
- Produces: API endpoint `POST /api/ai/gemini-prompt`

- [ ] **Step 1: Cập nhật `apps/server/src/server.ts`**
  Import `expandPromptWithGemini`, xử lý route `POST /api/ai/gemini-prompt` nhận `{ description, model, apiKey }`, trả về `{ success: true, prompt, tags }` hoặc thông báo lỗi nếu chưa có API key.
- [ ] **Step 2: Kiểm tra biên dịch và khởi động lại Server Bridge**
  Run: `npm run build --prefix apps/server`
  Expected: Mã thoát 0. Khởi động lại background task server tại cổng 3055.

---

### Task 3: Bổ sung Bảng nhặt Tag trực quan & Bố cục 2 cột trong `apps/studio/index.html`

**Files:**
- Modify: `apps/studio/index.html`

- [ ] **Step 1: Tái cấu trúc khung modal AI Studio**
  Mở rộng `modal-dialog` với độ rộng tối đa 860px.
  Tạo cấu trúc 2 cột:
  - Cột trái (`ai-tag-picker-panel`): Ô tìm kiếm tag, danh sách chip theo từng nhóm chủ đề (Đối tượng, Tóc, Biểu cảm, Trang phục, Vũ khí, Bối cảnh).
  - Cột phải (`ai-controls-panel`): Hộp trợ lý Gemini (Input + Nút tạo tag), Ô Textarea Prompt, Preset nhanh, Tùy chọn nâng cao (có ô nhập Gemini API Key), Hộp tiến trình và Nút Sinh ảnh.
- [ ] **Step 2: Kiểm tra cấu trúc HTML**
  Xác nhận các id quan trọng: `ai-gemini-desc-input`, `btn-gemini-expand`, `ai-tag-picker-container`, `tag-search-input`, `gemini-api-key-input`.

---

### Task 4: Cập nhật CSS hiển thị 2 cột và Tag Chips trong `apps/studio/styles/main.css`

**Files:**
- Modify: `apps/studio/styles/main.css`

- [ ] **Step 1: Viết style cho layout 2 cột và các thẻ chip**
  Thêm style cho `.ai-modal-layout-2col`, `.ai-tag-picker-panel`, `.ai-tag-category`, `.ai-tag-chip`, `.ai-tag-chip.active`, `.ai-gemini-box`.
  Hiệu ứng hover mượt mà, màu sắc neon nổi bật cho chip được kích hoạt.

---

### Task 5: Triển khai logic tương tác hai chiều & kết nối Gemini trong `apps/studio/src/main.ts`

**Files:**
- Modify: `apps/studio/src/main.ts`

- [ ] **Step 1: Định nghĩa danh mục tag và render các thẻ chip**
  Tạo hàm `renderTagPicker()` nạp các tag từ danh mục, gắn sự kiện click toggle.
- [ ] **Step 2: Tạo hàm đồng bộ hai chiều `syncTagsWithPrompt()`**
  Khi người dùng click chip, thêm/xóa tag khỏi ô prompt. Khi ô prompt thay đổi hoặc Gemini điền tag, cập nhật trạng thái sáng của các chip tương ứng.
- [ ] **Step 3: Tạo sự kiện cho nút "Gemini tạo Tags"**
  Gọi `POST http://127.0.0.1:3055/api/ai/gemini-prompt`, hiển thị trạng thái loading, tự động điền kết quả vào prompt và kích hoạt chip. Lưu API key vào `localStorage`.
- [ ] **Step 4: Biên dịch kiểm tra toàn bộ Studio Web**
  Run: `npm run build --prefix apps/studio`
  Expected: Mã thoát 0 (tsc + vite build thành công).

---

### Task 6: Kiểm tra xác minh toàn diện hệ sinh thái

- [ ] **Step 1: Kiểm tra WebSocket Bridge và Studio Dev Server**
  Xác nhận cả 2 dịch vụ đang chạy bình thường, nạp giao diện modal AI Studio và xác nhận layout 2 cột hiển thị cân đối.

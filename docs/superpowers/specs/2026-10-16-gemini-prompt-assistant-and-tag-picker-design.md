# Đặc tả thiết kế: Trợ lý AI Gemini Flash và Bảng nhặt Tag trực quan cho Pixel Draw

- **Ngày tạo:** 2026-10-16
- **Tác giả:** Antigravity AI & Pair Programmer
- **Trạng thái:** Đã phê duyệt (Approved)

---

## 1. Mục tiêu và Bối cảnh (Goal & Context)

### Vấn đề hiện tại
- Việc tạo prompt cho mô hình Stable Diffusion SD1.5 (AOM3A1B) và LoRA (`pixel_portrait_lora`, `pixel_f2`) đòi hỏi người dùng phải tự gõ các tag Danbooru tiếng Anh rời rạc (`1girl, purple hair, twin braids, glasses, plate armor, holding sword...`).
- Người dùng khó nhớ toàn bộ hàng trăm tag chuẩn xác, dễ dùng từ tiếng Anh văn chương mà mô hình AI không được huấn luyện, dẫn đến ảnh sinh ra không đúng ý hoặc bị nhòe, sai tư thế.

### Mục tiêu giải pháp
1. **Trợ lý Google Gemini (1.5 Flash / 2.0 Flash):** Người dùng chỉ cần nhập mô tả tự nhiên bằng tiếng Việt hoặc tiếng Anh (ví dụ: *"Một nữ pháp sư tóc tím đeo kính mỉm cười"*). Gemini được nhúng sẵn từ điển tag chuẩn `docs/pixel_art_tags_dictionary.json` sẽ tự động phân tích và chuyển đổi thành chuỗi Danbooru tags chính xác 100% với dữ liệu mà LoRA đã học.
2. **Bảng nhặt Tag trực quan theo chủ đề (Tag Picker Palette):** Bố cục giao diện 2 cột trong modal AI Studio. Cột bên trái hiển thị toàn bộ các tag được phân nhóm khoa học (Đối tượng, Tóc, Mắt, Biểu cảm, Trang phục, Vũ khí, Khung hình, Bối cảnh) dưới dạng các thẻ chip bấm chọn. Click vào tag để thêm hoặc bớt trực tiếp vào ô Prompt.
3. **Đồng bộ hai chiều (Two-way Synchronization):** Khi Gemini tạo tag hoặc người dùng gõ vào prompt, các tag tương ứng trên bảng bên trái tự động sáng lên (Active). Khi click bỏ chọn chip ở cột trái, tag tương ứng trong ô prompt tự động được gỡ bỏ.

---

## 2. Kiến trúc Hệ thống (System Architecture)

### 2.1. Backend Server (`apps/server/`)
- **Tệp mới: `apps/server/src/gemini-helper.ts`**
  - Chức năng: Gọi Google Gemini REST API v1beta (`models/gemini-1.5-flash:generateContent`).
  - Sử dụng `fetch` chuẩn của Node.js (không cần thêm thư viện ngoài).
  - Tự động nạp bộ từ điển tag từ `docs/pixel_art_tags_dictionary.json` vào phần `system_instruction` của Gemini.
  - Hỗ trợ Dynamic Model Context: Tự động điều chỉnh trigger tags và cỡ cảnh dựa trên LoRA người dùng đang chọn (`pixel_portrait_lora` -> `character portrait`, `pixel_f2` -> `full body, chibi`).
- **Endpoint mới: `POST /api/ai/gemini-prompt`** trong `apps/server/src/server.ts`:
  - Request Body:
    ```json
    {
      "description": "Nữ pháp sư tóc tím đeo kính mỉm cười",
      "model": "pixel_portrait_lora",
      "apiKey": "optional_override_key"
    }
    ```
  - Response Body:
    ```json
    {
      "success": true,
      "prompt": "pixel art, character portrait, 1girl, solo, purple hair, long hair, glasses, blue robe, smiling, looking at viewer, simple white background",
      "tags": ["pixel art", "character portrait", "1girl", "solo", "purple hair", "long hair", "glasses", "blue robe", "smiling", "looking at viewer", "simple white background"]
    }
    ```
- **Quản lý API Key:**
  - Ưu tiên 1: Đọc từ `process.env.GEMINI_API_KEY` (hoặc file `.env`).
  - Ưu tiên 2: Đọc từ trường `apiKey` do frontend gửi lên (người dùng nhập trên modal và lưu trong `localStorage`).

### 2.2. Frontend Studio (`apps/studio/`)
- **Cấu trúc lại giao diện Modal AI (`apps/studio/index.html`):**
  - Mở rộng modal thành dạng 2 cột:
    - **Cột trái (Tag Picker Palette - độ rộng ~280px):**
      - Thanh tìm kiếm tag nhanh (Filter input).
      - Các nhóm tag accordion/danh sách: Đối tượng, Màu tóc, Kiểu tóc, Biểu cảm, Trang phục, Vũ khí, Góc nhìn, Bối cảnh.
      - Nút bấm xóa nhanh toàn bộ tag đã chọn.
    - **Cột phải (AI Prompt Builder & Generator - độ rộng ~520px):**
      - Hộp Trợ lý Gemini: Input mô tả tiếng Việt + Nút "Gemini tạo Tags" kèm hiệu ứng loading.
      - Ô Textarea Prompt tổng hợp (người dùng vừa xem vừa chỉnh sửa được).
      - Các tùy chọn Preset nhanh (Retro Character, 16-bit RPG Hero, Scenery).
      - Tùy chọn nâng cao (LoRA, Checkpoint, Steps, Size, ô nhập Gemini API Key).
      - Hộp tiến trình thời gian thực (Step X/N, ETA) và nút Sinh ảnh AI.
- **Phong cách CSS (`apps/studio/styles/main.css`):**
  - Responsive flexbox / grid cho 2 cột.
  - Tag chip styles: nền tối, viền nhẹ, hiệu ứng chuyển màu neon khi active, hover mượt mà.
  - Scrollbar tùy chỉnh gọn gàng cho cột danh mục tag.
- **Logic tương tác (`apps/studio/src/main.ts`):**
  - Hàm `renderTagPicker()`: Khởi tạo danh sách chip từ từ điển tag.
  - Hàm `toggleTagInPrompt(tag)`: Thêm hoặc xóa tag khỏi textarea prompt.
  - Hàm `syncActiveTagsWithPrompt()`: Quét nội dung prompt hiện tại và cập nhật trạng thái sáng/tối của các chip.
  - Hàm `callGeminiPromptAssistant()`: Gửi mô tả tiếng Việt lên server và nạp kết quả trả về vào prompt.

---

## 3. Ràng buộc Kỹ thuật (Technical Constraints)

1. **Tuân thủ quy tắc người dùng:**
   - Tuyệt đối không tạo file test tự động.
   - Không tự động commit git.
   - Toàn bộ bình luận và tài liệu bằng tiếng Việt.
   - Không sử dụng biểu tượng cảm xúc / icon / emoji.
   - Định danh biến và hàm bằng tiếng Anh.
2. **Khả năng tương thích:**
   - Chạy độc lập không phụ thuộc internet nếu người dùng không dùng tính năng Gemini (vẫn dùng bảng Tag Picker và tự gõ prompt bình thường).
   - Nếu không có API Key, hiển thị cảnh báo thân thiện hướng dẫn lấy key miễn phí tại Google AI Studio (`aistudio.google.com`).

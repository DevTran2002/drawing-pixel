# Kế Hoạch Triển Khai: Chế Độ Tạo Hoạt Ảnh Chuyển Động Sprite Bằng AI (AI Sprite Animation Studio)

> **Mục tiêu:** Xây dựng chế độ chuyên biệt trong Modal AI Studio cho phép người dùng chốt nhân vật mẫu ở Bước 1, sau đó tự chọn hành động và số bước chuyển động (2, 3, 4, 6, 8 frames) ở Bước 2 để AI tự động sinh chuỗi SpriteSheet đồng bộ, tự động cắt thành các frame con và nạp thẳng vào Timeline Studio.

**Kiến trúc:** Bố cục Tab trong Modal AI (Ảnh tĩnh vs Hoạt ảnh Sprite). Sử dụng LoRA Pixel F2 trên Checkpoint AOM3 để sinh dải SpriteSheet đồng nhất 100% diện mạo nhân vật mẫu, sau đó tự động cắt thành N Frame độc lập nạp vào Animation Controller của Canvas Studio.

**Công nghệ:** Node.js, TypeScript, Python (Stable Diffusion 1.5 + LoRA + Pillow), HTML5 Canvas, WebSocket Bridge.

**Tài liệu đặc tả:** `docs/superpowers/specs/2026-10-16-ai-sprite-animation-studio-design.md`

## Các Ràng Buộc Bắt Buộc (Global Constraints)
- Tuyệt đối không tạo file test tự động (Quy tắc người dùng: Not create file test).
- Không tự động commit git (Quy tắc người dùng: Do not auto commit to git).
- Luôn trả lời và chú thích code bằng tiếng Việt.
- Không sử dụng biểu tượng cảm xúc hoặc icons/emojis.
- Đặt tên biến, hàm, interface bằng tiếng Anh.

---

### Task 1: Bổ sung nhóm Hành động & Tư thế (Actions & Poses) vào Từ điển và Trợ lý Gemini

**Mô tả:** Thêm danh mục `actions_and_poses` vào từ điển tag để người dùng có thể nhặt tag hành động trực quan và Trợ lý Gemini Flash có thể nhận diện chính xác các hành động từ mô tả tiếng Việt (đi bộ, vung kiếm chém, ngồi nghỉ, nằm gục, chạy, nhảy).

**Các file liên quan:**
- Chỉnh sửa: `docs/pixel_art_tags_dictionary.json`
- Chỉnh sửa: `apps/studio/src/data/tags-dictionary.ts`
- Chỉnh sửa: `apps/server/src/gemini-helper.ts`

**Các bước thực hiện:**
- [ ] Bổ sung nhóm `actions_and_poses` vào `docs/pixel_art_tags_dictionary.json` với các tag chuẩn: `walking`, `running`, `jumping`, `attacking`, `slashing`, `swinging sword`, `aiming bow`, `casting spell`, `sitting`, `kneeling`, `lying down`, `sleeping`, `defeated`, `hurt`, `standing`.
- [ ] Đồng bộ nhóm `actions_and_poses` vào file `apps/studio/src/data/tags-dictionary.ts`.
- [ ] Cập nhật System Instruction trong `apps/server/src/gemini-helper.ts` để nhận diện các hành động tiếng Việt và trích xuất tag tư thế tương ứng.
- [ ] Kiểm tra biên dịch backend: `npm run build --prefix apps/server`.

---

### Task 2: Backend Endpoint Sinh Hoạt Ảnh & Tự Động Cắt Khung Hình (`/api/ai/generate-animation`)

**Mô tả:** Xây dựng endpoint backend nhận thông tin nhân vật mẫu đã chốt (prompt, seed) kết hợp với hành động đã chọn và số khung hình (frameCount: 2, 3, 4, 6, 8) để sinh dải SpriteSheet ngang và tự động cắt thành danh sách N ảnh frame pixel matrix/base64.

**Các file liên quan:**
- Chỉnh sửa: `scripts/generate_pixel_art.py`
- Chỉnh sửa: `apps/server/src/server.ts`
- Chỉnh sửa: `apps/server/src/ai-helper.ts`

**Các bước thực hiện:**
- [ ] Cập nhật `scripts/generate_pixel_art.py` hỗ trợ cờ `--action`, `--frame_count`, `--sprite_sheet_mode` và tự động tính toán kích thước chiều rộng dải ảnh (`width = size * frame_count`).
- [ ] Thêm hàm cắt dải ảnh bằng thư viện Pillow trong Python (hoặc bóc tách qua `pngjs` trong Node) để chia dải ảnh thành N phần bằng nhau.
- [ ] Bổ sung endpoint `POST /api/ai/generate-animation` trong `apps/server/src/server.ts` nhận payload và phản hồi mảng N frames pixel data kèm metadata.
- [ ] Kiểm tra phản hồi API bằng Node fetch script.

---

### Task 3: Giao diện Modal AI Studio Tab "Tạo Hoạt Ảnh Sprite" (HTML & CSS)

**Mô tả:** Tái cấu trúc Modal AI Studio với 2 Tab chuyển đổi. Thiết kế giao diện Bước 1 (Chốt nhân vật mẫu) và Bước 2 (Chọn hành động & Số khung hình chuyển động).

**Các file liên quan:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`

**Các bước thực hiện:**
- [ ] Thêm thanh Tab Header trên đỉnh Modal AI Studio trong `index.html`: Tab 1 `Ảnh Tĩnh (Static Portrait)`, Tab 2 `Tạo Hoạt Ảnh Sprite (Sprite Animator)`.
- [ ] Thêm khối giao diện Tab 2 gồm:
  - Khung Bước 1: Thumbnail xem ảnh mẫu, Seed badge, nút "Chốt Mẫu Nhân Vật Này".
  - Khung Bước 2: Lưới chọn hành động (Walk, Attack, Idle, Sit, Defeated, Run, Jump) với badge số frame gợi ý.
  - Bộ chọn số khung hình linh hoạt (2, 3, 4, 6, 8 frames).
  - Tùy chọn Tách nền trong suốt (Remove background to transparent).
  - Nút hành động chính: "Tạo Sprite Hoạt Ảnh Bằng AI".
- [ ] Bổ sung CSS cho Tab Navigation, Action Selector Cards, Base Character Lock Badge trong `apps/studio/styles/main.css`.

---

### Task 4: Client Logic Tích Hợp Hoạt Ảnh & Nạp Timeline (`apps/studio/src/main.ts`)

**Mô tả:** Lập trình logic điều khiển luồng hoạt ảnh 2 bước trên Studio: chốt ảnh mẫu, gửi yêu cầu sinh SpriteSheet, nhận N frame cắt sẵn, tạo `AnimationClip` và nạp vào Timeline để phát chuyển động tức thì.

**Các file liên quan:**
- Chỉnh sửa: `apps/studio/src/main.ts`

**Các bước thực hiện:**
- [ ] Quản lý trạng thái Tab chuyển đổi (Static vs Sprite Animator).
- [ ] Quản lý biến trạng thái `baseCharacter`: lưu `seed`, `prompt`, `checkpoint`, `loraPath` của ảnh mẫu sau khi người dùng bấm "Chốt Mẫu".
- [ ] Lập trình sự kiện click chọn hành động (Action Cards) và thay đổi số frame.
- [ ] Lập trình nút "Tạo Sprite Hoạt Ảnh Bằng AI":
  - Gửi request tới `POST /api/ai/generate-animation`.
  - Hiển thị thanh tiến trình thời gian thực.
  - Khi hoàn tất: Bóc tách danh sách N frames nhận được.
  - Tự động tạo một `AnimationClip` mới trong Project (ví dụ: `Hero_Walk`, `Hero_Attack`).
  - Thêm N frames vào `project.frames` của Canvas Studio.
  - Kích hoạt Timeline và đồng bộ Preview Player bên phải tự động phát lặp hoạt cảnh.

---

### Task 5: Kiểm Tra Xác Thực Toàn Diện & Khởi Động Hệ Thống

**Mô tả:** Biên dịch toàn bộ các package, khởi động lại server Bridge và kiểm tra thực tế hoạt động tạo hoạt ảnh từ giao diện người dùng.

**Các bước thực hiện:**
- [ ] Chạy `npm run build --prefix apps/server` đảm bảo không có lỗi TypeScript.
- [ ] Chạy `npm run build --prefix apps/studio` đảm bảo không có lỗi Vite.
- [ ] Khởi động lại server Bridge chạy ngầm (`npx tsx apps/server/src/server.ts`).
- [ ] Thử nghiệm quy trình sinh nhân vật mẫu -> Chốt mẫu -> Sinh hoạt cảnh bước đi 4 frames -> Kiểm tra phát lặp trên Preview Player.
- [ ] Báo cáo kết quả chi tiết cho người dùng bằng tiếng Việt.

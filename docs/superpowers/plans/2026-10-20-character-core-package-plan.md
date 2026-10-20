# Kế Hoạch Triển Khai: Hệ Thống Đóng Gói Và Quản Lý Nhân Vật Cốt Lõi (Character Core Package)

> **Dành cho kỹ sư thực thi:** Sử dụng kỹ năng `superpowers:executing-plans` để thực thi kế hoạch này từng tác vụ một. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Xây dựng hệ thống đóng gói, lưu trữ và tái sử dụng Nhân vật cốt lõi (Character Core Package), tự động phân loại các chuỗi hoạt cảnh vào thư mục nhân vật và cho phép nạp lại nhân vật vào AI Studio để phát triển tiếp bất kỳ lúc nào.

**Kiến trúc:**
- Lưu trữ trên đĩa: Mỗi nhân vật sở hữu một thư mục riêng `storage/project_assets/characters/<slug>/` chứa `character_core.json`, `base_pose.png` và các thư mục hành động con (`walk/`, `idle/`, `attack/`...).
- Backend Server: Các REST endpoints phục vụ lưu trữ Core Package, cập nhật danh sách hành động, lấy danh sách nhân vật đã lưu.
- Studio Frontend: Tự động đóng gói ở Bước 2 khi chốt mẫu, tự động lưu frames vào thư mục con ở Bước 3/4, hỗ trợ menu chuột phải trên Cây thư mục để mở thẳng Bước 3 và nút chọn nhân vật có sẵn tại Bước 1.

**Công nghệ:** TypeScript, Express Backend, Vite Studio Frontend, Vanilla HTML/CSS, Canvas 2D.

**Tài liệu đặc tả (Spec):** [`docs/superpowers/specs/2026-10-20-character-core-package-design.md`](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-20-character-core-package-design.md)

## Các Ràng Buộc Toàn Cục (Global Constraints)
- Tuyệt đối không sử dụng emoji hoặc icon trong mã nguồn và câu trả lời.
- Toàn bộ chú thích trong mã nguồn phải viết bằng tiếng Việt có dấu.
- Đặt tên biến, hàm, interface bằng tiếng Anh theo chuẩn camelCase / PascalCase.
- Không tự động tạo tệp kiểm thử mới (sử dụng các tệp kiểm thử và suite hiện có).
- Không tự động commit git.
- Đảm bảo `npm run build` và `npx vitest run` luôn vượt qua 100%.

## Trọng Tâm Rà Soát (Review Focus)
1. Tên nhân vật chứa ký tự đặc biệt hoặc tiếng Việt có dấu -> Phải tự động chuyển đổi thành slug an toàn cho thư mục (ví dụ: "Chiến Binh Rồng" -> "chien_binh_rong").
2. Nhân vật đã tồn tại bị ghi đè không mong muốn -> Cung cấp cơ chế phân biệt ID hoặc tạo hậu tố thời gian khi trùng tên.
3. Đồng bộ Cây thư mục dự án (Project Asset Tree) -> Khi lưu nhân vật hoặc hành động mới, cây thư mục phải tự động cập nhật ngay trên giao diện mà không cần người dùng tải lại trang.
4. Nạp nhân vật vào Bước 3 -> Toàn bộ 16 điểm khớp khung xương (Joint Pinning) và mã Seed phải được khôi phục chính xác 100%.
5. Khung vẽ Canvas khi nạp ảnh gốc để sửa -> Kích thước Canvas (width, height) phải tự động co giãn khớp với kích thước của nhân vật gốc.

---

### Tác Vụ 1: Định Nghĩa Cấu Trúc Dữ Liệu `CharacterCoreData` Trong Shared Types

**Tệp tin:**
- Chỉnh sửa: `packages/shared-types/src/index.ts`

**Giao diện:**
- Cung cấp:
  - `CharacterCoreData` interface
  - `CharacterSummary` interface
  - `CharacterActionFolder` interface

- [ ] **Bước 1: Bổ sung định nghĩa `CharacterCoreData` vào `packages/shared-types/src/index.ts`**
  Thêm interface mô tả đầy đủ metadata nhân vật: id, name, slug, prompt, seed, width, height, pixels, colorPalette, skeletonRig, actions, createdAt, updatedAt.
- [ ] **Bước 2: Xác thực build gói shared-types**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/shared-types`
  Kết quả mong đợi: `ok` (thoát mã 0).

---

### Tác Vụ 2: Xây Dựng Backend Service & REST APIs Cho Nhân Vật Cốt Lõi

**Tệp tin:**
- Chỉnh sửa: `apps/server/src/asset-manager.ts`
- Chỉnh sửa: `apps/server/src/server.ts`

**Giao diện:**
- Cung cấp các endpoints:
  - `POST /api/characters/save-core`
  - `GET /api/characters/list`
  - `GET /api/characters/:id`
  - `POST /api/characters/:id/save-action`
  - `POST /api/characters/:id/update-core-pixels`

- [ ] **Bước 1: Bổ sung logic lưu trữ và đọc Character Package trong `asset-manager.ts`**
  - Hàm `saveCharacterCore(data: CharacterCoreData, base64Png?: string)`: Tạo thư mục `characters/<slug>`, ghi `character_core.json`, lưu `base_pose.png`, và đăng ký vào cây thư mục `tree_metadata.json`.
  - Hàm `listCharacterCores()`: Quét và trả về danh sách tóm tắt tất cả nhân vật trong `characters/`.
  - Hàm `getCharacterCore(idOrSlug: string)`: Đọc chi tiết `character_core.json`.
  - Hàm `saveCharacterAction(idOrSlug: string, action: string, frames: { name: string; pixels: PixelPoint[]; width: number; height: number; base64Png?: string }[])`: Lưu chuỗi frames vào `characters/<slug>/<action>/` và cập nhật metadata.
- [ ] **Bước 2: Đăng ký các REST route tương ứng trong `apps/server/src/server.ts`**
  - Thêm các route `/api/characters/*` với kiểm tra lỗi và trả về JSON chuẩn `{ success: true, data: ... }`.
- [ ] **Bước 3: Xác thực build server**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/server`
  Kết quả mong đợi: `tsc` biên dịch thành công không có lỗi.

---

### Tác Vụ 3: Tích Hợp Tự Động Đóng Gói Khi Chốt Mẫu Tại Bước 2 Của AI Studio

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Tiêu thụ: `POST /api/characters/save-core`
- Tạo modal nhập/xác nhận tên nhân vật khi người dùng bấm "Chốt Mẫu Này & Sang Bước 3".

- [ ] **Bước 1: Thêm modal xác nhận đặt tên nhân vật trong `apps/studio/index.html`**
  - Khung dialog nhỏ, gợi ý tên từ Prompt (ví dụ: "Warrior Knight"), cho phép người dùng đổi tên và bấm "Xác nhận & Đóng gói".
- [ ] **Bước 2: Xử lý sự kiện chốt mẫu trong `apps/studio/src/main.ts`**
  - Khi bấm `btn-step2-lock`:
    - Nếu chưa lưu gói nhân vật: Mở modal xác nhận tên.
    - Gọi API `POST /api/characters/save-core` để lưu nhân vật kèm Seed, Prompt, Pixel data, và 16 khớp khung xương.
    - Lưu định danh `currentCharacterSlug` vào trạng thái bộ nhớ Studio.
    - Làm mới Cây thư mục dự án bằng `assetBrowser.fetchTree()`.
    - Chuyển sang Bước 3.
- [ ] **Bước 3: Xác thực biên dịch Studio**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/studio`
  Kết quả mong đợi: Vite build thành công.

---

### Tác Vụ 4: Tự Động Lưu Hoạt Cảnh Vào Thư Mục Nhân Vật Ở Bước 3 Và Bước 4

**Tệp tin:**
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Tiêu thụ: `POST /api/characters/:id/save-action`

- [ ] **Bước 1: Cập nhật hàm hoàn thành sinh hoạt cảnh trong `apps/studio/src/main.ts`**
  - Khi các khung hình chuyển động được tạo xong (bằng Puppet Rigging, Hybrid, hoặc AI):
    - Tự động gọi API `POST /api/characters/:id/save-action` để lưu toàn bộ các frame vào `characters/<slug>/<action>/`.
    - Làm mới lại Cây thư mục dự án để người dùng thấy ngay thư mục hành động xuất hiện trong Project Dock.
    - Nạp các frame vào Timeline như bình thường.
- [ ] **Bước 2: Xác thực build Studio**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/studio`

---

### Tác Vụ 5: Tái Sử Dụng Nhân Vật Gốc Từ Cây Thư Mục Dự Án (Project Dock)

**Tệp tin:**
- Chỉnh sửa: `apps/studio/src/main.ts`
- Chỉnh sửa: `apps/studio/styles/main.css`

**Giao diện:**
- Tiêu thụ: `GET /api/characters/:id`
- Mở cửa sổ ngữ cảnh (Context Menu) trên Cây thư mục dự án cho các mục nhân vật.

- [ ] **Bước 1: Thêm tùy chọn menu ngữ cảnh cho thư mục nhân vật và tệp `character_core.json`**
  - Menu mục 1: "Tạo động tác mới từ nhân vật này (AI Studio)" -> Đọc dữ liệu nhân vật, đưa vào `baseCharState`, nạp khung xương và chuyển thẳng sang Bước 3 của AI Studio.
  - Menu mục 2: "Nạp lên Canvas để chỉnh sửa thủ công" -> Đưa `base_pose.png` lên Canvas để người dùng vẽ tiếp.
- [ ] **Bước 2: Thêm thanh thông báo "Đang sửa Nhân vật gốc" trên Canvas**
  - Khi đang chỉnh sửa nhân vật gốc trên Canvas, hiển thị nút "Lưu cập nhật vào Nhân vật gốc" để ghi đè điểm ảnh mới vào `base_pose.png` và `character_core.json`.
- [ ] **Bước 3: Xác thực build Studio**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/studio`

---

### Tác Vụ 6: Bổ Sung Nút "Chọn Nhân Vật Có Sẵn Từ Dự Án" Tại Bước 1 AI Studio

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Tiêu thụ: `GET /api/characters/list`
- Tạo modal duyệt danh mục nhân vật đã lưu.

- [ ] **Bước 1: Thêm nút bấm tại Bước 1 và Modal danh mục nhân vật trong `apps/studio/index.html`**
  - Nút "Chọn Nhân Vật Có Sẵn Từ Dự Án" đặt cạnh "Tải Mẫu Từ Máy Tính" ở thanh chân modal Bước 1.
  - Bảng danh mục dạng lưới hiển thị các thẻ nhân vật: Ảnh đại diện, Tên, Seed, Danh sách các động tác đã có.
- [ ] **Bước 2: Xử lý sự kiện tải danh sách và chọn nhân vật trong `apps/studio/src/main.ts`**
  - Khi mở modal: Gọi `GET /api/characters/list` và render lưới thẻ nhân vật.
  - Khi chọn một nhân vật: Gọi `GET /api/characters/:id`, nạp dữ liệu vào `baseCharState`, khôi phục 16 khớp khung xương và chuyển thẳng tới Bước 3.
- [ ] **Bước 3: Xác thực build Studio**
  Chạy lệnh: `npm run build --workspace=@pixel-draw/studio`

---

### Tác Vụ 7: Kiểm Thử Toàn Diện Monorepo & Nghiệm Thu Quy Trình

**Tệp tin:**
- Toàn bộ các workspace trong monorepo

- [ ] **Bước 1: Chạy build toàn bộ Monorepo**
  Chạy lệnh: `npm run build`
  Kết quả mong đợi: Toàn bộ 4 package (`@pixel-draw/shared-types`, `@pixel-draw/mcp`, `@pixel-draw/server`, `@pixel-draw/studio`) đều build thành công, mã thoát 0.
- [ ] **Bước 2: Chạy bộ kiểm thử tự động Vitest**
  Chạy lệnh: `npx vitest run`
  Kết quả mong đợi: 100% test suites (11/11 files, 42/42 tests) đều PASS.
- [ ] **Bước 3: Kiểm tra trạng thái Git**
  Chạy lệnh: `git status --short`
  Đảm bảo không tự ý commit git theo đúng quy chuẩn người dùng.

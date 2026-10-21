# Kế Hoạch Triển Khai: Tái Cấu Trúc Giao Diện & Không Gian Làm Việc (Workspace Redesign)

> **Dành cho Agent thực thi:** BẮT BUỘC SỬ DỤNG KỸ NĂNG: Sử dụng superpowers:subagent-driven-development để thực thi kế hoạch này theo từng tác vụ độc lập. Các bước sử dụng cú pháp ô kiểm (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu (Goal):** Tái cấu trúc toàn diện giao diện Pixel Art Studio theo mô hình 4 Không gian làm việc (Vẽ Pixel, Hoạt Ảnh, AI Studio, Tài Nguyên), phân nhóm thanh công cụ có tooltip tức thì và hướng dẫn ngữ cảnh, tích hợp Animation Preview vào Timeline, loại bỏ mã kéo thả dock rác và chuẩn hóa toàn bộ chú thích mã nguồn sang tiếng Việt có dấu chuẩn Unicode UTF-8.

**Kiến trúc (Architecture):** 
1. Hệ thống Workspace Mode Controller điều khiển trạng thái hiển thị của các khối giao diện (Draw, Animate, AI, Assets) thông qua thuộc tính dữ liệu `data-workspace-mode` trên container chính.
2. Phân nhóm Left Toolbar thành 4 khối chức năng với Floating Instant Tooltips và Context Hint Bar thời gian thực dưới Canvas.
3. Tích hợp khung Animation Preview trực tiếp vào Timeline bar ở đáy màn hình.
4. Xóa bỏ các khối DOM và logic thừa của hệ thống kéo thả chia đôi dock kiểu cũ.
5. Chuẩn hóa 100% chú thích (comments) trong mã nguồn sang tiếng Việt có dấu.

**Công nghệ sử dụng (Tech Stack):** TypeScript, HTML5 Semantic, CSS3 Modern Flexbox/Grid (Dark Theme), Vite, Canvas API, Vitest.

**Tài liệu thiết kế (Spec):** [2026-10-21-workspace-redesign.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-21-workspace-redesign.md)

## Ràng Buộc Toàn Cục (Global Constraints)

- Luôn trả lời và tương tác bằng tiếng Việt có dấu đầy đủ, đúng ngữ pháp và chuẩn Unicode UTF-8.
- Toàn bộ chú thích (code comments) được thêm mới hoặc chỉnh sửa BẮT BUỘC phải viết bằng tiếng Việt có dấu đầy đủ.
- Tuyệt đối không sử dụng biểu tượng cảm xúc (icons hoặc emojis) trong câu trả lời và trong chú thích code.
- Tuyệt đối không tự động commit git (không chạy `git commit` nếu người dùng không yêu cầu).
- Sử dụng tiếng Anh cho các định danh kỹ thuật (tên biến, hàm, ID, class CSS, thuộc tính HTML).
- Đảm bảo 100% các bài kiểm thử tự động hiện tại (`npm test`) tiếp tục chạy thành công (PASS).

## Trọng Tâm Rà Soát (Review Focus)

1. Kiểm tra chuyển đổi giữa 4 chế độ Workspace (Draw, Animate, AI, Assets) không làm mất dữ liệu Canvas, Frame hoặc Layer hiện tại.
2. Kiểm tra thanh công cụ bên trái chuyển đổi công cụ trơn tru, Context Hint Bar cập nhật đúng hướng dẫn theo từng công cụ được chọn.
3. Khung xem trước hoạt ảnh Animation Preview tích hợp trên Timeline phát chuyển động chính xác theo số FPS và frame hiện hành.
4. Các nút bấm không còn hiện tượng lặp chữ "+ +".
5. Mã nguồn không còn sót các hàm sự kiện kéo thả dock rác bị mồ côi.

---

### Tác Vụ 1: Tái Cấu Trúc Header Với Workspace Switcher, Hộp Thoại Hướng Dẫn Nhanh & Dọn Dẹp DOM Rác

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`

**Giao diện:**
- Cung cấp:
  - Cụm nút chuyển Workspace: `#workspace-switch-draw`, `#workspace-switch-animate`, `#workspace-switch-ai`, `#workspace-switch-assets` với lớp `.workspace-switch-btn`.
  - Hộp thoại Hướng Dẫn Nhanh: `#quick-guide-modal`, `#btn-open-quick-guide`, `#btn-close-quick-guide`.
  - Sửa lỗi lặp chữ nút `#btn-add-action-folder` và `#btn-add-frame`.
  - Loại bỏ hoàn toàn: `#dock-drop-overlay`, `#dock-tab-drag-proxy`, `#dock-splitter-resizer`, `#dock-split-actions`, `#dock-mode-hint`.

- [ ] **Bước 1: Chỉnh sửa `apps/studio/index.html` để cập nhật Header và dọn dẹp DOM rác**
  - Thêm bộ chuyển đổi Workspace vào thanh điều hướng Header.
  - Bổ sung nút "Hướng dẫn nhanh" và modal Quick Guide chứa hướng dẫn 4 bước cho người mới cùng bảng phím tắt.
  - Sửa nhãn các nút Timeline thành `+ Động tác` và `+ Thêm Frame` (không lặp dấu `+`).
  - Xóa bỏ các khối phần tử DOM kéo thả chia đôi dock.

- [ ] **Bước 2: Bổ sung CSS cho Workspace Switcher, Quick Guide Modal và dọn dẹp CSS kéo thả dock**
  - Chỉnh sửa `apps/studio/styles/main.css` để định kiểu cho các nút chuyển Workspace với trạng thái active sắc nét, hiệu ứng chuyển động mượt mà.
  - Định kiểu cho modal Quick Guide.
  - Xóa bỏ các bộ chọn CSS liên quan đến `.dock-drop-overlay`, `.dock-tab-drag-proxy`, `.dock-splitter-resizer`.

- [ ] **Bước 3: Kiểm tra tính hợp lệ của mã HTML và CSS**
  - Chạy `npm test` để xác nhận cấu trúc dự án không bị lỗi cú pháp.

---

### Tác Vụ 2: Phân Nhóm Thanh Công Cụ Bên Trái, Thêm Instant Tooltip & Context Hint Bar

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Tiêu thụ:
  - 12 công cụ vẽ hiện có trong `left-toolbar`.
- Cung cấp:
  - 4 nhóm công cụ có tiêu đề nhóm hoặc đường phân cách tinh tế: Selection, Drawing, Shapes, Effects.
  - Phần tử hiển thị Tooltip tức thì: `#instant-tooltip` lớp `.instant-floating-tooltip`.
  - Thanh chỉ dẫn ngữ cảnh: `#context-hint-bar` lớp `.context-hint-bar` đặt dưới Canvas, hiển thị văn bản hướng dẫn theo công cụ đang kích hoạt.

- [ ] **Bước 1: Cấu trúc lại các nút công cụ trong `apps/studio/index.html` theo 4 nhóm**
  - Nhóm 1 (Chọn): select (S), magicwand (W), move (M).
  - Nhóm 2 (Vẽ): pencil (P), eraser (E), bucket (G), eyedropper (I).
  - Nhóm 3 (Hình học): line (L), rectangle (U), circle (C).
  - Nhóm 4 (Hiệu ứng): dither (J), lighten (D), darken (K).
  - Thêm phần tử `#context-hint-bar` vào khu vực `#viewport`.
  - Thêm phần tử `#instant-tooltip` nổi vào cuối `body`.

- [ ] **Bước 2: Định kiểu CSS cho các nhóm công cụ, Instant Tooltip và Context Hint Bar**
  - Trong `apps/studio/styles/main.css`: Định kiểu thanh công cụ chia nhóm chuyên nghiệp, tooltip nổi hiện ngay khi rê chuột với nền đen bóng mờ bo góc và viền sáng tinh tế, Context Hint Bar hiển thị ở cạnh dưới Canvas.

- [ ] **Bước 3: Viết mã xử lý hiển thị Tooltip tức thì và cập nhật Hint Bar trong `apps/studio/src/main.ts`**
  - Bổ sung bản đồ hướng dẫn ngữ cảnh `TOOL_HINTS` cho từng loại công cụ bằng tiếng Việt có dấu.
  - Cập nhật hàm kích hoạt công cụ để tự động đổi nội dung hiển thị của `#context-hint-bar`.
  - Bổ sung trình lắng nghe sự kiện `mouseenter` và `mouseleave` trên các nút công cụ để hiển thị `#instant-tooltip` ngay lập tức tại vị trí chuột.

- [ ] **Bước 4: Kiểm tra sự kích hoạt và thông tin hiển thị của công cụ**
  - Chạy `npm test` để đảm bảo không làm gián đoạn các bài test hiện có.

---

### Tác Vụ 3: Tích Hợp Khung Animation Preview Vào Timeline & Bố Cục Chế Độ Hoạt Ảnh

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Cung cấp:
  - Khung xem trước hoạt ảnh tích hợp: `#timeline-preview-card` chứa `#timeline-preview-canvas` (kích thước 100x100 hoặc 112x112 px) và nhãn thời gian thực `#timeline-preview-info`.
  - Kết nối `PreviewPlayer` đồng bộ với canvas xem trước mới này.
  - Cấu hình kích thước và bố cục Timeline mở rộng khi ở chế độ Hoạt Ảnh (`data-workspace-mode="animate"`).

- [ ] **Bước 1: Thêm phần tử Animation Preview vào khu vực Timeline trong `apps/studio/index.html`**
  - Đặt `#timeline-preview-card` ngay cạnh cụm nút điều khiển của Timeline (trước danh sách các frame).
  - Giữ lại hoặc đồng bộ với preview canvas ở sidebar phải để người dùng có thể xem ở cả hai nơi tùy nhu cầu.

- [ ] **Bước 2: Cập nhật CSS cho Timeline mở rộng và khung xem trước**
  - Trong `apps/studio/styles/main.css`: Thiết lập kích cỡ, viền bo tròn, bóng đổ cho `#timeline-preview-card`.
  - Tối ưu hóa chiều cao của `#bottom-dock` khi chuyển đổi giữa chế độ `draw` (thu gọn) và `animate` (mở rộng thoáng đãng).

- [ ] **Bước 3: Cập nhật logic trong `apps/studio/src/main.ts` để render khung xem trước Timeline**
  - Kết nối vòng lặp render của `PreviewPlayer` hoặc sự kiện đổi frame vào `#timeline-preview-canvas`.
  - Đảm bảo khi bấm Play/Pause trên Timeline, hoạt cảnh phát mượt mà trên khung xem trước này.

- [ ] **Bước 4: Kiểm tra tính năng phát hoạt ảnh**
  - Chạy `npm test` để đảm bảo bài test `animation-controller.test.ts` hoàn toàn vượt qua.

---

### Tác Vụ 4: Tích Hợp Chế Độ Quản Lý Tài Nguyên & Bộ Chuyển Đổi Workspace

**Tệp tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`
- Chỉnh sửa: `apps/studio/src/main.ts`

**Giao diện:**
- Cung cấp:
  - Bộ điều khiển chuyển đổi Workspace trong `main.ts`: hàm `setWorkspaceMode(mode: 'draw' | 'animate' | 'ai' | 'assets')`.
  - Tích hợp không gian Quản Lý Tài Nguyên (Assets Mode) kết nối cây thư mục dự án và danh sách ảnh Gallery.

- [ ] **Bước 1: Viết hàm `setWorkspaceMode` trong `apps/studio/src/main.ts`**
  - Xử lý chuyển đổi thuộc tính `data-workspace-mode` trên phần tử `body` hoặc `#studio-root`.
  - Khi `mode === 'draw'`: Bật đầy đủ công cụ vẽ, ẩn bớt phần thừa, thu gọn timeline.
  - Khi `mode === 'animate'`: Mở rộng timeline, tập trung vào các frame và khung preview.
  - Khi `mode === 'ai'`: Mở modal AI Studio tự động.
  - Khi `mode === 'assets'`: Hiển thị khu vực quản lý tài nguyên và thư mục dự án.
  - Gắn sự kiện click cho các nút `#workspace-switch-*` trên Header.

- [ ] **Bước 2: Gắn sự kiện cho hộp thoại Hướng Dẫn Nhanh (Quick Guide Modal)**
  - Mở modal khi bấm `#btn-open-quick-guide`.
  - Đóng modal khi bấm `#btn-close-quick-guide` hoặc click ra ngoài phông nền / phím Escape.

- [ ] **Bước 3: Tối ưu CSS cho các chế độ Workspace**
  - Đảm bảo chuyển đổi mượt mà giữa các chế độ bằng hiệu ứng CSS transition.

- [ ] **Bước 4: Kiểm tra chuyển đổi chế độ làm việc**
  - Chạy `npm test` để xác nhận tính toàn vẹn hệ thống.

---

### Tác Vụ 5: Dọn Dẹp Mã Nguồn Kéo Thả Dock Rác & Chuẩn Hóa Chú Thích Sang Tiếng Việt Có Dấu

**Tệp tin:**
- Chỉnh sửa: `apps/studio/src/main.ts`
- Chỉnh sửa: `apps/studio/src/core/asset-browser-controller.ts`
- Chỉnh sửa: `apps/studio/src/core/canvas-engine.ts`
- Chỉnh sửa: `apps/studio/src/animation/animation-controller.ts`

**Giao diện:**
- Xóa bỏ:
  - Toàn bộ hàm, biến và trình lắng nghe sự kiện liên quan đến kéo thả chia đôi dock trong `main.ts` (các biến drag dock, drop zone listeners, splitter drag).
- Chuẩn hóa:
  - 100% chú thích (comments) trong các tệp trên được viết bằng tiếng Việt có dấu chuẩn Unicode UTF-8.

- [ ] **Bước 1: Rà soát và gỡ bỏ mã kéo thả dock trong `apps/studio/src/main.ts`**
  - Xóa bỏ các trình xử lý sự kiện `dragstart`, `dragover`, `drop` của dock tabs và drop zones.
  - Xóa bỏ biến liên quan đến dock split không còn dùng.

- [ ] **Bước 2: Chuẩn hóa chú thích mã nguồn sang tiếng Việt có dấu**
  - Chuyển đổi toàn bộ các đoạn chú thích không dấu trong `apps/studio/src/main.ts` sang tiếng Việt có dấu đầy đủ.
  - Chuyển đổi chú thích trong `asset-browser-controller.ts`, `canvas-engine.ts`, `animation-controller.ts`.

- [ ] **Bước 3: Chạy toàn bộ bài kiểm thử tự động của dự án**
  - Chạy lệnh `npm test` để kiểm tra toàn bộ 11 bộ test files (42 tests).
  - Đảm bảo 100% tests PASS và không có lỗi biên dịch TypeScript (`tsc --noEmit`).

---

### Tác Vụ 6: Kiểm Thử Trực Quan Giao Diện Mới Bằng Trình Duyệt MCP

**Tệp tin:**
- Kiểm thử môi trường chạy thực tế: `http://localhost:5173/`

- [ ] **Bước 1: Truy cập lại `http://localhost:5173/` bằng công cụ trình duyệt MCP**
  - Sử dụng `navigate_page` hoặc reload để tải phiên bản giao diện mới.
- [ ] **Bước 2: Chụp ảnh màn hình (Screenshot) và kiểm tra tương tác từng chế độ**
  - Chụp ảnh giao diện Chế độ Vẽ (Draw Mode) với thanh công cụ chia nhóm và Hint Bar.
  - Bấm chuyển sang Chế độ Hoạt Ảnh (Animate Mode) và chụp ảnh Timeline mở rộng kèm Live Preview.
  - Bấm mở hộp thoại Hướng Dẫn Nhanh (Quick Guide Modal) và kiểm tra nội dung.
- [ ] **Bước 3: Báo cáo kết quả và xác nhận hoàn tất nghiệm thu**

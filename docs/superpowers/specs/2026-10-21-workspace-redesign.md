# Tài Liệu Thiết Kế: Tái Cấu Trúc Giao Diện & Quy Hoạch Không Gian Làm Việc (Workspace Redesign)

## 1. Tổng Quan & Mục Tiêu

Hệ thống Pixel Art Studio hiện tại sở hữu nền tảng kỹ thuật mạnh mẽ (Engine vẽ pixel nhiều lớp, dòng thời gian hoạt cảnh đa động tác, tích hợp mô hình AI SD1.5 & LoRA, cắt lưới sprite và bộ gán khung xương 16 khớp OpenPose). Tuy nhiên, giao diện hiện tại gặp nhiều bất cập lớn về trải nghiệm người dùng (UX):
- Thiếu định hướng cho người mới bắt đầu: Màn hình khởi động trống trơn, thanh công cụ bên trái chỉ gồm các ký tự viết tắt đơn lẻ (S, W, M, P, E, G, I, L, U, C, J, D, K) không có phân nhóm hay hướng dẫn rõ ràng.
- Các tính năng bị phân tán và thiếu kết nối: Khung xem trước hoạt ảnh (Animation Preview) bị đẩy xuống góc dưới thanh bên phải, tách rời khỏi Dòng thời gian (Timeline) ở đáy màn hình; Hệ thống quản lý tài nguyên bị chia thành 2 nơi (Kho Ảnh Gallery modal và Thư mục Dự án Project asset browser ở đáy) khiến người dùng bối rối.
- Giao diện có nhiều thành phần rác: Cơ chế kéo thả chia đôi dock vụng về (dock-drop-overlay, dock-splitter-resizer), các nút bị lặp chữ hiển thị "+ + Động tác", "+ + Add Frame".
- Chú thích mã nguồn (Comments) trong nhiều tệp vẫn viết bằng tiếng Việt không dấu.

Mục tiêu của thiết kế mới:
1. Quy hoạch lại toàn bộ giao diện theo mô hình Không gian làm việc (Workspace Modes): Vẽ Pixel (Draw), Làm Hoạt Cảnh (Animate), AI Studio (AI), và Thư Viện Tài Nguyên (Assets).
2. Tái cấu trúc thanh công cụ bên trái thành 4 nhóm trực quan có tooltip tức thì và thanh hướng dẫn thao tác chuột theo ngữ cảnh công cụ.
3. Tích hợp khung Animation Preview trực tiếp vào khu vực Dòng thời gian Timeline, xóa bỏ hoàn toàn mã kéo thả chia đôi dock rác.
4. Cung cấp hộp thoại Hướng Dẫn Nhanh (Quick Guide) và Tạo Canvas Mới trực quan cho người mới.
5. Dọn dẹp các khối HTML/CSS/JS thừa, chuyển đổi toàn bộ chú thích trong mã nguồn sang tiếng Việt có dấu chuẩn Unicode UTF-8.

---

## 2. Kiến Trúc Không Gian Làm Việc (Workspace Modes)

Thanh điều hướng trên cùng (Header) sẽ được tích hợp bộ chuyển đổi chế độ làm việc (Workspace Switcher) với 4 trạng thái chính:

### 2.1. Chế độ Vẽ Pixel (Draw Mode - Mặc định)
- Trọng tâm: Tối đa hóa diện tích vẽ trên Canvas trung tâm.
- Thanh công cụ bên trái (Left Toolbar): Hiển thị đầy đủ 4 nhóm công cụ vẽ chi tiết.
- Thanh bên phải (Right Sidebar):
  - Bảng màu (Color Palette): Bộ chọn màu chính/phụ, bảng mã hex, kích thước nét cọ (1px, 2px, 3px, 4px) và lưới 32 màu.
  - Quản lý Layer: Danh sách các lớp vẽ, nút thêm layer, thêm nhóm, ẩn/hiện, khóa và đổi tên.
- Dòng thời gian Timeline ở đáy: Được thu gọn ở dạng thanh điều khiển mini gọn gàng để không chiếm dụng diện tích Canvas.

### 2.2. Chế độ Làm Hoạt Cảnh (Animate Mode)
- Trọng tâm: Tập trung toàn lực vào việc tạo chuỗi khung hình chuyển động và căn chỉnh nhịp điệu.
- Dòng thời gian Timeline ở đáy: Tự động mở rộng chiều cao (chiếm khoảng 260px - 300px), hiển thị rõ ràng:
  - Danh sách thư mục động tác (Action Folders: Tư thế gốc, Đứng im, Chạy bộ, Tấn công...).
  - Dải thumbnail các Frame cỡ lớn, dễ kéo thả và sắp xếp thứ tự.
  - Cụm điều khiển tích hợp: Tích hợp ngay khung xem trước hoạt ảnh (Animation Preview Live Player) kích thước 120x120 px ngay bên cạnh dải frame, giúp người dùng vừa vẽ vừa thấy chuyển động chạy mượt mà ngay trước mắt.
  - Các nút điều khiển chuẩn: Play/Pause, Frame trước/sau, Onion Skin bật/tắt, thanh trượt tốc độ FPS và cài đặt thời lượng mili-giây từng frame.

### 2.3. Chế độ AI Studio (AI Mode)
- Trọng tâm: Tạo nhân vật và sinh chuỗi hoạt cảnh bằng trí tuệ nhân tạo.
- Quy hoạch luồng 4 bước thông minh:
  - Bước 1: Thiết kế nhân vật (Bảng nhặt Tag theo chủ đề, Trợ lý Gemini mở rộng prompt, Phong cách mẫu 1-click, Tùy chỉnh Checkpoint và LoRA).
  - Bước 2: Xem trước & Chốt mẫu nhân vật chuẩn (Khóa Seed, Vẽ lại Reroll, Cập nhật từ Canvas đã sửa, Bộ cắt lưới Sprite Sheet và xem thử).
  - Bước 3: Cấu hình hoạt cảnh & Gán khung xương OpenPose (Lựa chọn động thái Walk/Attack/Idle/Run, tùy chọn VFX vệt chém, bảng gán 16 khớp trực quan 384x384 px).
  - Bước 4: Tạo hoạt cảnh hoàn chỉnh & Nạp trực tiếp vào Timeline của Studio.

### 2.4. Chế độ Thư Viện Tài Nguyên (Assets & Gallery Mode)
- Trọng tâm: Hợp nhất Kho Lưu Trữ Tác Phẩm (Gallery) và Cây Thư Mục Dự Án (Project Asset Tree).
- Giao diện 2 cột chuyên nghiệp:
  - Cột trái: Cây thư mục dự án phân cấp (Characters, Sprites, Animations, Backgrounds) kèm các nút thêm thư mục, đồng bộ máy chủ.
  - Cột phải: Lưới hiển thị tài nguyên với các thẻ card ảnh sắc nét, bộ lọc phân loại (Tất cả, Dự án .pxdraw, Sprite Hoạt Cảnh, AI Pixel Art), ô tìm kiếm nhanh và thanh trượt phóng to thu nhỏ thumbnail.
  - Tích hợp các nút hành động 1-click: "Nạp lên Canvas vẽ tiếp", "Nạp vào Timeline làm hoạt cảnh", "Tải về máy", "Xóa".

---

## 3. Chi Tiết Thiết Kế Các Thành Phần Giao Diện

### 3.1. Thanh Điều Hướng Header Mới
- Bên trái:
  - Logo "Pixel Studio" thiết kế hiện đại.
  - Nút kích thước Canvas hiện tại (nhấp để mở modal đổi cỡ Canvas).
  - Tỷ lệ thu phóng Canvas (nhấp để căn giữa và đặt lại 100%).
- Ở giữa:
  - Cụm phím chuyển đổi chế độ làm việc (Workspace Switcher):
    - `Vẽ Pixel` (data-mode="draw")
    - `Hoạt Ảnh` (data-mode="animate")
    - `AI Studio` (data-mode="ai")
    - `Tài Nguyên` (data-mode="assets")
- Bên phải:
  - Cụm Hoàn tác/Làm lại (Undo / Redo).
  - Trạng thái kết nối Máy chủ / Bridge (Online / Offline).
  - Nút Hướng Dẫn Nhanh (Quick Guide) mở bảng hướng dẫn phím tắt và mẹo vẽ.
  - Nút Xuất Tác Phẩm (Export) xuất file PNG, Sprite Sheet và dự án .pxdraw.

### 3.2. Thanh Công Cụ Vẽ Bên Trái (Left Toolbar)
Chia thành 4 nhóm công cụ rõ ràng với đường phân cách và biểu tượng SVG sắc nét:
1. **Nhóm Chọn (Selection Group)**:
   - `Chọn vùng (S)`: Chọn vùng hình chữ nhật để di chuyển, sao chép (Ctrl+C), dán (Ctrl+V) hoặc xóa (Delete).
   - `Đũa thần (W)`: Tự động chọn mảng pixel cùng màu.
   - `Di chuyển (M)`: Dịch chuyển vùng chọn hoặc toàn bộ lớp vẽ.
2. **Nhóm Vẽ (Drawing Group)**:
   - `Bút chì (P)`: Vẽ từng điểm ảnh pixel (Chuột trái: Màu chính, Chuột phải: Màu phụ).
   - `Tẩy xóa (E)`: Xóa điểm ảnh về trong suốt.
   - `Thùng sơn (G)`: Tô màu toàn bộ mảng pixel đồng màu.
   - `Hút màu (I)`: Lấy mã màu trực tiếp từ điểm ảnh trên Canvas.
3. **Nhóm Hình Học (Shapes Group)**:
   - `Đường thẳng (L)`: Vẽ đoạn thẳng theo thuật toán Bresenham.
   - `Chữ nhật (U)`: Vẽ khung hình chữ nhật pixel.
   - `Hình tròn (C)`: Vẽ đường tròn chuẩn thuật toán trung điểm (Midpoint).
4. **Nhóm Hiệu Ứng (Effects Group)**:
   - `Tô Dither (J)`: Tô hoa văn caro đan xen hạt màu pixel art.
   - `Tăng sáng (D)`: Nâng độ sáng của điểm ảnh khi vẽ qua.
   - `Làm tối (K)`: Giảm độ sáng của điểm ảnh khi vẽ qua.

Bổ sung:
- **Floating Instant Tooltip**: Khi rê chuột qua công cụ, hiển thị tức thì hộp chú giải gồm tên tiếng Việt đầy đủ, phím tắt in đậm và mô tả ngắn.
- **Thanh Chỉ Dẫn Ngữ Cảnh (Context Hint Bar)** đặt ngay dưới Canvas:
  Hiển thị gợi ý thao tác thời gian thực: Ví dụ `[Bút chì] Chuột trái: Vẽ màu chính | Chuột phải: Vẽ màu phụ | Giữ Space: Kéo Canvas`.

### 3.3. Dòng Thời Gian & Khung Xem Trước Chuyển Động (Timeline & Unified Preview)
- Di chuyển khung Animation Preview từ thanh bên phải xuống đặt cạnh thanh điều khiển của Timeline (hoặc cho phép mở rộng linh hoạt).
- Khắc phục lỗi lặp văn bản: Thay nhãn `+ + Động tác` thành `+ Động tác`, thay `+ + Add Frame` thành `+ Thêm Frame`.
- Bổ sung chỉ số trực quan: Tốc độ khung hình (FPS), thời lượng từng frame (ms), thông số frame hiện tại (ví dụ: Frame 1 / 4).

### 3.4. Hộp Thoại Hướng Dẫn Nhanh & Khởi Tạo Dự Án (Quick Guide Modal)
- Cung cấp hướng dẫn ngắn gọn cho người mới:
  - Bước 1: Chọn kích thước Canvas phù hợp (16x16 cho game cổ điển, 24x24 / 32x32 cho RPG, 64x64 cho nhân vật chi tiết).
  - Bước 2: Dùng Bút chì (P) và Thùng sơn (G) để phác thảo nhân vật từ màu chính/phụ.
  - Bước 3: Chuyển sang chế độ Hoạt Ảnh để nhân bản frame và tạo chuyển động bước đi, tấn công.
  - Bước 4: Hoặc dùng AI Studio để tự động tạo nhân vật và hoạt cảnh chỉ trong vài giây.
- Bảng tra cứu các phím tắt quan trọng nhất: Space (Kéo canvas), Cuộn chuột (Zoom), Ctrl+Z (Undo), Ctrl+Y (Redo), P (Bút), E (Tẩy), G (Tô màu), I (Hút màu), H (Lật ngang), V (Lật dọc).

---

## 4. Dọn Dẹp Mã Nguồn Rác & Chuẩn Hóa Chú Thích

1. **Loại bỏ mã nguồn thừa**:
   - Xóa bỏ các phần tử DOM phục vụ cơ chế kéo thả chia đôi dock: `#dock-drop-overlay`, `#dock-tab-drag-proxy`, `#dock-splitter-resizer`, `#dock-split-actions`.
   - Gỡ bỏ toàn bộ các đoạn mã lắng nghe sự kiện kéo thả tab phức tạp trong `main.ts` liên quan đến `dock-drop-zone`, giúp mã nguồn nhẹ hơn, dễ bảo trì và loại bỏ hoàn toàn các lỗi tiềm ẩn.
   - Xóa các biến trạng thái không còn sử dụng.
2. **Chuẩn hóa chú thích (Comments) sang tiếng Việt có dấu**:
   - Rà soát các tệp mã nguồn chính: `apps/studio/src/main.ts`, `apps/studio/src/core/asset-browser-controller.ts`, `apps/studio/src/core/canvas-engine.ts`, `apps/studio/src/animation/animation-controller.ts`, `apps/studio/src/tools/*.ts`.
   - Thay thế toàn bộ chú thích không dấu kiểu cũ thành tiếng Việt có dấu chuẩn Unicode UTF-8.

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. Giao diện có thanh chuyển đổi chế độ làm việc (Workspace Switcher) hoạt động trơn tru:
   - Khi chọn "Vẽ Pixel": Canvas hiển thị rộng rãi, Sidebar Bảng màu và Layer mở đầy đủ, Timeline thu gọn.
   - Khi chọn "Hoạt Ảnh": Timeline mở rộng, có khung Animation Preview hiển thị chuyển động ngay cạnh danh sách frame, điều khiển Onion Skin và FPS mượt mà.
   - Khi chọn "AI Studio": Mở giao diện AI Studio 4 bước rõ ràng, dễ thao tác.
   - Khi chọn "Tài Nguyên": Mở trung tâm quản lý tài nguyên thống nhất (cây thư mục và lưới tranh ảnh).
2. Thanh công cụ vẽ bên trái được phân nhóm rõ ràng, có tooltip tức thì và thanh chỉ dẫn thao tác chuột ngữ cảnh dưới Canvas.
3. Không còn bất kỳ lỗi lặp chữ `+ +` nào trên giao diện.
4. Toàn bộ mã nguồn rác liên quan đến kéo thả chia đôi dock được dọn dẹp sạch sẽ.
5. Chú thích trong các tệp mã nguồn được chuyển đổi sang tiếng Việt có dấu đầy đủ.
6. 100% các bài kiểm thử tự động hiện tại (`npm test`) tiếp tục chạy thành công (PASS).

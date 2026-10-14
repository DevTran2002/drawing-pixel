# Tài Liệu Đặc Tả Thiết Kế: Pixel Art Studio & MCP Integration Engine

- Ngày tạo: 2026-10-14
- Trạng thái: Bản thảo thiết kế kiến trúc (Architectural Spec)
- Thư mục dự án: d:/pixel_draw
- Custom Skill: C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist

---

## 1. Mục Tiêu và Phạm Vi Dự Án

### 1.1. Mục tiêu
Xây dựng một hệ sinh thái vẽ đồ họa pixel (Pixel Art) và hoạt ảnh nhân vật (Character Sprite Animation) hoàn chỉnh, bao gồm:
1. **Pixel Studio Web App:** Ứng dụng web đồ họa pixel hiệu năng cao lấy cảm hứng từ PixAssets Studio với giao diện Dark theme hiện đại, đầy đủ công cụ vẽ, bảng màu, quản lý layers và dòng thời gian hoạt ảnh (Timeline & Animation Clips).
2. **WebSocket Bridge & Local Server:** Máy chủ cục bộ điều phối truyền nhận dữ liệu thời gian thực, lưu trữ trạng thái canvas và kết xuất file ảnh (PNG, SpriteSheet, JSON).
3. **MCP Server (Model Context Protocol):** Cung cấp bộ công cụ chuẩn để AI (trong Antigravity, Claude, Gemini) có thể tương tác trực tiếp với canvas đang mở hoặc vẽ xuất file độc lập.
4. **Custom Skill (pixel-artist):** Bộ kỹ năng AI có cấu trúc mô-đun mở rộng (Style Profiles & Animation Templates), giúp AI tự động vẽ sprite và xuất asset đúng phong cách cho các dự án game/web chỉ định.

### 1.2. Ràng buộc kỹ thuật
- Ngôn ngữ & Nền tảng: Node.js, TypeScript, Vite, HTML5 Canvas 2D API, WebSocket (ws).
- Giao diện: Tối ưu hiệu năng render canvas với thuộc tính `image-rendering: pixelated; crisp-edges`, phóng to tối đa 3200% không bị mờ nhòe.
- Không sử dụng icon/emoji trong mã nguồn và giao tiếp.
- Mọi ghi chú mã nguồn phải bằng tiếng Việt.
- Không tự động commit git.

---

## 2. Kiến Trúc Hệ Thống (System Architecture)

Dự án được cấu trúc theo dạng Monorepo tại thư mục `d:/pixel_draw`:

```
d:/pixel_draw/
├── package.json
├── tsconfig.base.json
├── apps/
│   ├── studio/                     # Web App Pixel Art Studio (Vite + TypeScript)
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── core/               # Canvas Engine, Pixel Matrix, Layers, History
│   │   │   ├── tools/              # Các công cụ vẽ (Pencil, Bucket, Line, Dither, ...)
│   │   │   ├── animation/          # Timeline, Clips, Frames, Onion Skin
│   │   │   ├── palette/            # Bảng màu, Swatches, Color extraction
│   │   │   ├── ws/                 # WebSocket Client kết nối với Local Server
│   │   │   └── ui/                 # Giao diện Dark theme, TopBar, ToolBar, SideBar
│   │   └── styles/
│   ├── server/                     # Local Hub & WebSocket Bridge (Node.js + ws)
│   │   ├── src/
│   │   │   ├── server.ts           # Khởi chạy HTTP Server + WebSocket Bridge (Port 3055)
│   │   │   ├── state-manager.ts    # Bộ đệm trạng thái Canvas trong RAM
│   │   │   └── exporter.ts         # Xuất ảnh PNG (hỗ trợ scale 1x - 16x) & SpriteSheet
│   └── mcp/                        # Model Context Protocol Server (Stdio)
│       ├── src/
│       │   ├── index.ts            # Điểm vào MCP Server Stdio
│       │   ├── tools.ts            # Định nghĩa các tool MCP cho AI
│       │   └── bridge-client.ts    # Kết nối gửi lệnh tới Local Server
└── skills/
    └── pixel-artist/               # Mẫu cấu hình Custom Skill (sẽ cài vào Global Skills)
        ├── SKILL.md
        ├── styles/                 # Các hồ sơ phong cách (16bit, 8bit, chibi, cyberpunk, ...)
        └── templates/              # Khung xương chuyển động (idle, walk, attack, recoil)
```

---

## 3. Đặc Tả Giao Diện và Tính Năng Studio (apps/studio)

### 3.1. Canvas Engine
- Kích thước mặc định linh hoạt: 16x16, 24x24, 32x32, 48x48, 64x64, hoặc người dùng nhập kích thước bất kỳ.
- Tỷ lệ thu phóng (Zoom): Từ 100% đến 3200%. Tự động căn giữa không gian làm việc.
- Lưới điểm ảnh (Pixel Grid): Bật/tắt lưới tọa độ khi phóng to trên 400%.
- Cơ chế Undo / Redo: Hỗ trợ tối thiểu 50 bước lịch sử thao tác với phím tắt chuẩn Ctrl+Z và Ctrl+Y.
- Kéo thả không gian vẽ (Pan): Giữ phím Spacebar hoặc con lăn chuột giữa để di chuyển khung vẽ.

### 3.2. Bộ công cụ vẽ (Left Toolbar)
1. **Pencil (Bút chì):** Vẽ pixel theo nét, kích thước cọ: 1px, 2px, 3px, 4px.
2. **Eraser (Tẩy):** Xóa pixel về trạng thái rỗng (trong suốt RGBA = 0,0,0,0).
3. **Paint Bucket (Thùng sơn):** Thuật toán Flood Fill 4 hướng đổ màu liền kề.
4. **Eyedropper (Ống hút màu):** Hút màu tại tọa độ click và đưa vào cọ chính.
5. **Rectangle Select (Chọn vùng):** Chọn vùng chữ nhật để cắt, sao chép, di chuyển.
6. **Move Tool (Di chuyển):** Dịch chuyển điểm ảnh trong layer hoặc vùng chọn.
7. **Line Tool (Đoạn thẳng):** Thuật toán Bresenham cho đường thẳng pixel thẳng hàng.
8. **Rectangle Tool (Hình chữ nhật):** Tùy chọn vẽ viền hoặc vẽ đặc ruột.
9. **Circle Tool (Hình tròn):** Thuật toán Midpoint Circle cho đường tròn pixel cân đối.
10. **Checker Dither (Họa tiết caro):** Tô đan xen 2 màu tạo độ chuyển sáng tối cổ điển.
11. **Lighten / Darken:** Tăng/giảm 10% độ sáng HSL của pixel được bấm.
12. **Mirror Symmetry:** Chế độ đối xứng trục dọc (X) hoặc trục ngang (Y) để vẽ nhân vật đối xứng nhanh chóng.

### 3.3. Quản lý Lớp (Layers Panel)
- Danh sách Layer xếp chồng theo thứ tự từ trên xuống dưới.
- Thao tác: Thêm layer mới (+), Xóa layer, Nhân bản layer, Gộp xuống layer dưới (Merge Down).
- Thuộc tính mỗi layer: Tên layer, Trạng thái hiển thị (Bật/Tắt mắt), Khóa (Lock), Độ trong suốt (Opacity 0 - 100%).

### 3.4. Dòng thời gian và Hoạt ảnh Nhân vật (Timeline & Animation System)
- **Hệ thống nhãn hoạt ảnh (Animation Tags / Clips):**
  - Quản lý các nhóm động tác: `idle` (ví dụ frame 0-1), `walk` (frame 2-5), `attack` (frame 6-8).
  - Tùy chọn phát vòng lặp theo nhãn đang chọn (Loop by Tag).
- **Điều khiển Khung hình (Frames):**
  - Thêm frame rỗng, Nhân bản frame hiện tại, Xóa frame, Kéo đổi thứ tự frame.
  - Cài đặt thời gian hiển thị độc lập cho từng frame (mặc định 100ms/frame).
  - Thanh trượt điều chỉnh tốc độ toàn cục (1 - 30 FPS).
- **Onion Skinning có phân biệt màu sắc:**
  - Khung hình trước (Previous Frame) hiển thị bóng mờ sắc đỏ nhẹ.
  - Khung hình sau (Next Frame) hiển thị bóng mờ sắc xanh lục nhẹ.
  - Nút bật/tắt nhanh chế độ Onion Skin.
- **Điểm neo nhân vật (Pivot / Origin Point):**
  - Cho phép người dùng hoặc AI định vị điểm tiếp đất của nhân vật để đảm bảo không bị lệch trục khi đổi giữa các clip chuyển động.
- **Cửa sổ xem trước (Mini Animation Preview Window):**
  - Khung nhỏ cố định ở góc phát lặp hoạt ảnh theo tỷ lệ 1x và 2x thời gian thực.

### 3.5. Bảng màu (Color Palette)
- Chọn màu chính (Primary) và màu phụ (Secondary).
- Tích hợp sẵn các bảng màu tiêu chuẩn:
  - Pico-8 (16 màu)
  - Game Boy Classic (4 màu)
  - NES Classic (54 màu)
  - Endesga 32 (32 màu tuyệt đẹp cho game nhập vai/hành động)
  - Dawnbringer 16/32 (32 màu chuẩn nghệ thuật pixel)
- Tự động trích xuất "Màu đang sử dụng" (Colors in Use) trên canvas.

### 3.6. Cơ chế Xuất tệp (Export Options)
- **PNG ảnh tĩnh:** Hỗ trợ hệ số phóng đại 1x (kích thước thực), 2x, 4x, 8x, 16x bằng thuật toán Nearest-Neighbor (không làm mờ pixel).
- **SpriteSheet:** Xuất toàn bộ frame thành dải ngang (Strip) hoặc ma trận lưới (Grid).
- **JSON Metadata:** Xuất kèm tệp mô tả tọa độ frame, kích thước, tên clip hoạt ảnh (tương thích các Game Engine như Phaser, Pixi, Unity, Godot hoặc mã HTML5 Canvas).
- **Project JSON:** Lưu trữ toàn bộ project bao gồm tất cả layers, frames, tags để mở lại tiếp tục vẽ.

---

## 4. Đặc Tả MCP Server & WebSocket Bridge (apps/server & apps/mcp)

### 4.1. WebSocket Bridge Protocol (Port 3055)
- Server chạy nền lắng nghe cổng 3055.
- Cơ chế trao đổi dữ liệu:
  - Khi Studio kết nối: Gửi sự kiện `CLIENT_CONNECTED`, Server đồng bộ trạng thái gần nhất về Studio.
  - Khi AI gọi tool MCP: MCP gửi thông điệp `DRAW_COMMAND` tới Server, Server cập nhật bộ đệm trong RAM và phát sóng tức thì tới Studio.
  - Khi người dùng vẽ trên Studio: Studio gửi `USER_EDIT_EVENT` về Server để cập nhật bộ đệm, đảm bảo AI luôn lấy được dữ liệu mới nhất.

### 4.2. Danh sách MCP Tools cung cấp cho AI
1. **`create_canvas`**:
   - Tham số: `width` (number), `height` (number), `name` (string).
   - Thiết lập không gian vẽ mới.
2. **`get_canvas_state`**:
   - Tham số: `include_matrix` (boolean, mặc định: false).
   - Trả về kích thước canvas, danh sách các animation clips, danh sách layers, bảng màu hiện có và ma trận điểm ảnh dạng văn bản.
3. **`draw_matrix`**:
   - Tham số: `palette_map` (object dạng `{"#": "#000000", "R": "#ff0000", ".": null}`), `matrix` (mảng các dòng ký tự), `layer_id` (tùy chọn), `frame_index` (tùy chọn), `offset_x` (number), `offset_y` (number).
   - Cho phép AI vẽ cả một khối ảnh hoặc sprite hoàn chỉnh chỉ bằng một mảng chuỗi trực quan.
4. **`draw_pixels`**:
   - Tham số: `pixels` (mảng đối tượng `{ x, y, color }`), `layer_id` (tùy chọn), `frame_index` (tùy chọn).
   - Thêm hoặc sửa các pixel riêng lẻ.
5. **`draw_shape`**:
   - Tham số: `shape_type` ("line" | "rect" | "circle"), `params` (tọa độ, bán kính, fill: boolean), `color`.
6. **`flood_fill`**:
   - Tham số: `x` (number), `y` (number), `color` (string).
7. **`create_animation_clip`**:
   - Tham số: `tag_name` (string, ví dụ: "idle", "walk", "attack"), `start_frame` (number), `end_frame` (number), `fps` (number).
8. **`draw_animation_frame`**:
   - Tham số: `tag_name` (string), `frame_index` (number), `palette_map` (object), `matrix` (array of strings), `duration_ms` (number).
9. **`copy_frame_with_offset`**:
   - Tham số: `source_frame` (number), `target_frame` (number), `offset_x` (number), `offset_y` (number).
   - Hỗ trợ AI tạo frame chuyển động nhịp nhàng mà không phải vẽ lại từ đầu.
10. **`export_spritesheet`**:
    - Tham số: `output_path` (đường dẫn tuyệt đối hoặc tương đối tới dự án game đích), `scale` (number, 1-16), `export_json_meta` (boolean).
    - Tạo file PNG SpriteSheet và file JSON mô tả animation trực tiếp tại thư mục dự án được chỉ định.

---

## 5. Đặc Tả Custom Skill (skills/pixel-artist)

Được cài đặt trực tiếp vào: `C:\Users\hn.ngoitv\.gemini\config\skills\pixel-artist`

### 5.1. Cấu trúc mô-đun
- **`SKILL.md`**: Bản hướng dẫn cốt lõi cho AI. Quy định các bước làm việc:
  - Tiếp nhận yêu cầu vẽ (đối tượng, kích thước, mục đích sử dụng).
  - Quét thư mục `styles/` để tìm hồ sơ phong cách phù hợp (hoặc tự tạo cấu hình tạm thời nếu người dùng yêu cầu phong cách mới).
  - Quét thư mục `templates/` nếu cần vẽ hoạt ảnh nhân vật để lấy khung xương chuẩn.
  - Sử dụng các MCP tools để dựng sprite và animation.
  - Xuất file vào thư mục tài nguyên dự án người dùng mong muốn.
- **Thư mục `styles/` (Mở rộng tự do):**
  - `16bit-classic.md`: Viền tối sel-out, chuyển màu dải 3-4 mức, tỷ lệ nhân vật 1:2.5 hoặc 1:3.
  - `8bit-retro.md`: Bảng màu tối giản 4-16 màu, viền đen rõ nét, không khử răng cưa.
  - `chibi-rpg.md`: Đầu to thân nhỏ (tỷ lệ 1:1), mắt 2-3 pixel sáng, màu sắc tươi vui.
  - `cyberpunk-scifi.md`: Gam màu tối kết hợp neon, bề mặt kim loại, tối ưu cho vũ khí và xạ thủ.
  - `lineless-modern.md`: Phong cách đồ họa phẳng, không viền, bóng đổ theo mảng lớn.
  - `custom-template.md`: Bản mẫu chuẩn giúp người dùng dễ dàng thêm phong cách mới chỉ bằng vài dòng mô tả.
- **Thư mục `templates/` (Khung xương hoạt ảnh):**
  - `humanoid-idle-2f.json`: Nhịp thở nhấp nhô 1 pixel.
  - `humanoid-walk-4f.json`: Chu kỳ bước chân 4 khung hình (tiếp đất, nhấc chân, đổi bên).
  - `gun-recoil-3f.json`: Động tác bắn súng và giật ngược nòng.
  - `slash-attack-3f.json`: Chuẩn bị vung kiếm, chém quét cung tròn, thu thế.

---

## 6. Chiến Lược Kiểm Thử và Đảm Bảo Chất Lượng (Testing Strategy)

1. **Kiểm thử Canvas Engine:**
   - Kiểm tra độ chính xác của các thuật toán Bresenham (đoạn thẳng), Midpoint (đường tròn), Flood Fill (tràn màu) không bị tràn ra ngoài biên canvas.
   - Kiểm tra cơ chế Undo/Redo khôi phục chính xác trạng thái từng layer.
2. **Kiểm thử WebSocket Bridge & Realtime Sync:**
   - Kiểm thử kết nối WebSocket giữa Node.js server và Studio: gửi lệnh vẽ `draw_matrix` từ script test và xác nhận điểm ảnh hiển thị tức thì trên canvas Studio.
   - Kiểm thử chế độ ngắt kết nối (Studio đóng): Server vẫn thực thi lệnh vẽ và xuất file PNG/JSON hợp lệ vào đĩa cứng.
3. **Kiểm thử Xuất tệp (Export):**
   - Xác minh tệp PNG xuất ra đúng kích thước, không bị nhòe (thuật toán Nearest Neighbor).
   - Xác minh file JSON Metadata chứa đúng cấu trúc frame và tag hoạt ảnh, có thể nạp thử vào game engine.
4. **Kiểm thử Custom Skill & MCP:**
   - Chạy lệnh AI vẽ thử một sprite nhân vật 24x24 gồm clip `idle` và `walk` bằng Custom Skill, sau đó xác nhận file xuất vào thư mục đích.

---

## 7. Kế Hoạch Triển Khai (Implementation Phases)

- **Giai đoạn 1:** Khởi tạo cấu trúc Monorepo, cài đặt các phụ thuộc cơ bản (Vite, TypeScript, ws, mcp-sdk).
- **Giai đoạn 2:** Xây dựng core Canvas Engine của Web Studio (Canvas, Layers, History, Bảng công cụ vẽ cơ bản, Bảng màu).
- **Giai đoạn 3:** Xây dựng hệ thống Animation Timeline (Frames, Tags/Clips, Onion Skin, Mini Preview).
- **Giai đoạn 4:** Xây dựng Local WebSocket Bridge Server và tính năng xuất file (PNG, SpriteSheet, JSON).
- **Giai đoạn 5:** Xây dựng MCP Server với đầy đủ các tools giao tiếp với Server/Studio.
- **Giai đoạn 6:** Xây dựng và cài đặt Custom Skill `pixel-artist` cùng các Style Profiles và Templates vào Global Skills.
- **Giai đoạn 7:** Kiểm thử toàn diện đầu-cuối (End-to-End Test): Dùng AI kích hoạt skill, gọi MCP vẽ hoạt ảnh nhân vật hiển thị trực tiếp lên Web Studio và xuất file asset thực tế.

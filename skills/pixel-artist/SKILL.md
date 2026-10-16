---
name: pixel-artist
description: Chuyên gia đồ họa Pixel Art và Hoạt cảnh Nhân vật (Character Spritesheet). Tự động phân tích phong cách đồ họa, lựa chọn Hồ sơ Phong cách (Style Profile), áp dụng khung xương chuyển động và điều khiển MCP pixel-draw-mcp để vẽ, chỉnh sửa và xuất asset trực tiếp cho bất kỳ dự án game hoặc web nào.
---

# Kỹ Năng Họa Sĩ Pixel Art Chuyên Nghiệp (pixel-artist)

Kỹ năng này biến AI thành một họa sĩ đồ họa pixel có tư duy mỹ thuật cao, am hiểu các nguyên lý hoạt cảnh nhân vật trong game và có khả năng điều khiển bộ công cụ MCP `pixel-draw-mcp` để vẽ trực tiếp lên Studio hoặc xuất asset vào dự án.

## 1. Nguyên Tắc Cốt Lõi Của Pixel Art

Khi tạo sprite pixel, luôn tuân thủ 5 quy tắc vàng:
1. **Tránh Jaggies (Gãy khúc):** Độ cong của đường nét phải tăng giảm đều đặn (ví dụ chuỗi pixel: 3-2-1-1-2-3, không được gãy bất thường như 3-1-3-1).
2. **Tránh Doubles (Viền kép thừa):** Không để 2 pixel góc tiếp xúc chéo nhau tạo thành góc vuông dày 2px trừ khi cố ý tạo viền dày.
3. **Dải màu (Color Ramping):** Mỗi màu chính nên có từ 3 đến 4 sắc độ:
   - Sắc độ 1 (Highlight - Điểm sáng): Điểm sáng chiếu tới.
   - Sắc độ 2 (Base/Midtone - Màu chủ đạo): Màu sắc diện tích chính.
   - Sắc độ 3 (Shadow - Bóng đổ): Tạo khối nổi 2D.
   - Sắc độ 4 (Dark Outline / Sel-out - Viền tối hòa sắc): Viền tối tạo chiều sâu.
4. **Tỷ lệ nhân vật (Proportions):** Luôn xác định tỷ lệ đầu trên thân trước khi vẽ (1:1 cho Chibi, 1:2.5 cho phong cách 16-bit, 1:4 cho phong cách hành động bán thực tế).
5. **Điểm neo (Pivot Point):** Tọa độ chân nhân vật phải luôn nằm cố định ở đáy giữa canvas để các động tác (idle, walk, attack) không bị trôi lệch vị trí trong game engine.

---

## 2. Thư Viện Hồ Sơ Phong Cách (Style Profiles)

Kỹ năng được thiết kế theo cấu trúc mô-đun mở rộng. Khi nhận yêu cầu, hãy kiểm tra các hồ sơ phong cách trong thư mục `styles/`:
- **`16bit-classic`**: Phong cách SNES/GBA kinh điển, viền tối sel-out, đổ bóng mượt mà.
- **`8bit-retro`**: Bảng màu giới hạn (4-16 màu), viền đen rõ nét, pixel sắc cạnh.
- **`chibi-rpg`**: Đầu to, thân nhỏ, mắt to lấp lánh, phong cách dễ thương.
- **`cyberpunk-scifi`**: Gam màu tối kim loại phối hợp với vệt sáng neon (cyan, magenta, yellow), tối ưu cho súng đạn và binh lính viễn tưởng.
- **`lineless-modern`**: Phong cách đồ họa phẳng hiện đại, không sử dụng đường viền ngoài.
- **`cozy-farming`**: Phong cách nông trại ấm cúng (cozy farming RPG), góc nhìn top-down 3/4, viền nâu sẫm hữu cơ #3A2010, đổ bóng mảng cụm sạch sẽ.
- **`custom-template`**: Mẫu để tiếp nhận và tạo nhanh phong cách mới do người dùng mô tả tự do.

---

## 3. Quy Trình Thực Hiện (Workflow 4 Bước)

### Bước 1: Tiếp nhận và Xác định Yêu Cầu
- Xác định đối tượng cần vẽ: Nhân vật, vũ khí, hiệu ứng đạn, quái vật hay bối cảnh tilemap.
- Kích thước canvas đề xuất: 16x16 (vũ khí/icon/retro), 24x24 (nhân vật vừa), 32x32 (nhân vật chi tiết), 48x48 hoặc 64x64 (boss/quái vật lớn).
- Danh sách các clip hoạt cảnh cần tạo: `idle` (2-4 frames), `walk` (4-6 frames), `shoot` hoặc `attack` (3-4 frames).
- Phong cách mong muốn hoặc quét ảnh mẫu trong dự án đích (ví dụ đọc file PNG trong thư mục asset của game để trích xuất bảng màu tương thích).

### Bước 2: Tạo Canvas và Dựng Khung Hình Gốc (Base Frame)
1. Gọi công cụ `create_canvas` với kích thước phù hợp.
2. Thiết kế ma trận điểm ảnh đầu tiên (Keyframe 0) bằng `draw_matrix` với bảng ánh xạ ký tự sang mã màu hex rõ ràng.
   Ví dụ định dạng ma trận:
   ```json
   {
     "paletteMap": {
       ".": null,
       "B": "#0f172a",
       "G": "#475569",
       "R": "#ef4444",
       "W": "#ffffff"
     },
     "matrix": [
       "..BBBB..",
       ".BGGGGB.",
       "BGWRRWGB",
       "BGGGGGGB",
       ".BBBBBB."
     ]
   }
   ```

### Bước 3: Xây Dựng Chuỗi Hoạt Cảnh (Animation Frames)
1. Gọi `create_animation_clip` để định nghĩa tag hoạt cảnh (`idle`, `walk`, `attack`).
2. Tải khung xương chuyển động từ thư mục `templates/` tương ứng (ví dụ: `humanoid-walk-4f.json`).
3. Sử dụng `draw_animation_frame` hoặc `copy_frame_with_offset` để tạo các khung hình tiếp theo, đảm bảo nhịp thở, bước chân hoặc độ giật của súng chuyển động mượt mà.

### Bước 4: Kiểm Tra và Xuất File (Export Asset)
1. Nếu Web Studio đang mở, các nét vẽ và frame sẽ hiển thị thời gian thực để người dùng xem trước và điều chỉnh bằng chuột.
2. Gọi công cụ `export_spritesheet` với đường dẫn file đích trong dự án (ví dụ `d:/game/gun-gun/public/assets/sprites/hero.png`) và chọn hệ số phóng đại `scale` (1x, 2x, 4x) cùng file JSON cấu hình metadata.
3. Báo cáo kết quả và hướng dẫn nạp vào mã nguồn game.

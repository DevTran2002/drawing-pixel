# Đặc Tả Kỹ Thuật: Hệ Thống Phụ Kiện Modular LPC, Bảng Màu Shading & AI Re-skin

- **Ngày tạo**: 2026-10-22
- **Trạng thái**: Chờ phê duyệt (Pending Review)
- **Tác giả**: Antigravity Assistant & DevTran2002
- **Dự án**: Pixel Draw Studio (`d:\pixel_draw`)

---

## 1. Tổng Quan & Mục Tiêu Nghiệp Vụ

### 1.1 Vấn Đề Hiện Tại
- Trước đây, trong LPC Character Studio chỉ có duy nhất 1 layer cơ thể trần (`sprites.png`).
- Khi chuyển sang AI Studio để render, phôi đầu vào là người trần đầu trọc. Dù prompt có mô tả áo giáp và tóc dài, nếu để `strength` thấp (0.32) thì AI không thể vẽ thêm trang phục; nếu để `strength` cao (0.48 - 0.60) thì các frame bị rung rinh, nhấp nháy (flickering), thiếu đồng nhất.

### 1.2 Mục Tiêu
Triển khai kiến trúc **Hệ Thống Kép (Hybrid Dual System)** kết hợp giữa chuẩn đồ họa **Universal LPC Spritesheet Generator** và **Model AI LoRA Pixel Art**:
1. **Lắp ráp phụ kiện đa tầng (Modular Paper Doll)**: Cho phép chọn các lớp phụ kiện chuẩn LPC: Thân (Body), Tóc (Hair), Áo giáp (Torso/Armor), Quần (Pants).
2. **Đổi màu giữ nguyên bóng khối (Palette Recolor & Shading)**: Thay đổi dải màu cho từng layer theo các bảng màu gradient (Color Ramps) chuẩn pixel art, giữ nguyên 100% ánh sáng (highlights) và bóng đổ (shadows).
3. **Cầu nối Re-skin & Shading sang AI**: Đưa dải phôi đã có đầy đủ tóc và trang phục sang AI Studio để Model SD1.5 + LoRA nâng cấp chất liệu ở `strength = 0.30 - 0.32`, đảm bảo đồng bộ tuyệt đối 100% giữa tất cả các khung hình.
4. **Xuất trực tiếp cho Game**: Cho phép xuất dải sprite hoặc atlas sheet đã phối màu dùng trực tiếp cho game RPG 2D mà không bắt buộc phải qua AI.

---

## 2. Kiến Trúc & Thiết Kế Thành Phần

### 2.1 Cấu Trúc Dữ Liệu & Thư Viện Asset (`public/lpc_assets/`)
Chuẩn hóa các sprite sheet phụ kiện theo kích thước LPC 13 cột x 54 hàng (832x3456 px hoặc dải tối ưu):
- `body_base.png`: Phôi cơ thể chuẩn (đã có sẵn trong hệ thống).
- `hair_warrior.png`: Layer tóc dài chiến binh (Z-Index: 50).
- `armor_plate.png`: Layer áo giáp ngực kim loại (Z-Index: 40).
- `pants_leather.png`: Layer quần da chiến binh (Z-Index: 30).

### 2.2 Bộ Bảng Màu Chuẩn (Palette Ramp Engine - `lpc-palette.ts`)
Mỗi dải màu trong LPC được định nghĩa bằng một chuỗi mã màu hex từ tối đến sáng (5 đến 8 bậc màu):
- **Bảng màu Tóc (Hair Palettes)**:
  - `brown` (Nâu tự nhiên): `['#2b180d', '#4d2a14', '#78431e', '#a56230', '#cf874e']`
  - `blonde` (Vàng hoe): `['#423211', '#73571d', '#aa832d', '#d8b24e', '#f8df85']`
  - `red` (Đỏ hung): `['#3b110a', '#691d12', '#9f2e1e', '#cf4c38', '#f27c69']`
  - `raven` (Đen huyền): `['#14171a', '#24292e', '#39414a', '#545f6b', '#7a8896']`
  - `silver` (Bạch kim): `['#2a2c30', '#474b52', '#727883', '#a3abb8', '#d5dbe4']`
- **Bảng màu Áo Giáp / Trang Phục (Armor / Cloth Palettes)**:
  - `steel_blue` (Thép xanh): `['#182333', '#273b54', '#3d5c82', '#5881b5', '#7eaae6']`
  - `golden` (Vàng kim hoàng gia): `['#38290a', '#5e4511', '#8c6819', '#c4972e', '#f5cc5b']`
  - `crimson` (Đỏ thắm hiệp sĩ): `['#360e15', '#591622', '#8c2436', '#c2384f', '#f06279']`
  - `emerald` (Xanh lục ngọc): `['#0d2919', '#17472c', '#246b43', '#399e65', '#5fd48f']`
- **Bảng màu Quần (Pants Palettes)**:
  - `leather_brown` (Da nâu): `['#1d140e', '#332318', '#523826', '#755137', '#9c6f4c']`
  - `dark_iron` (Sắt xám tối): `['#15171a', '#26292e', '#3c4147', '#575d66', '#79808a']`

### 2.3 Thuật Toán Thay Thế Dải Màu (Palette Swapping Algorithm)
Hàm `recolorCanvasByPalette(sourceCanvas, sourceRamp, targetRamp)`:
1. Đọc dữ liệu điểm ảnh `ctx.getImageData()`.
2. Duyệt qua từng pixel: So khớp màu của pixel với các màu trong `sourceRamp` theo khoảng cách sai khác màu RGB nhỏ nhất (Euclidean Distance với ngưỡng dung sai < 12).
3. Nếu khớp bậc sắc độ $i$, thay thế bằng màu tại bậc $i$ trong `targetRamp`.
4. Ghi lại dữ liệu bằng `ctx.putImageData()`.
5. Đảm bảo giữ nguyên 100% độ trong suốt (Alpha channel).

### 2.4 Tích Hợp Giao Diện LPC Studio Modal (`lpc-studio-modal.ts`)
- **Danh sách Layer bên trái**:
  - Checkbox Bật/Tắt hiển thị từng layer.
  - Tên layer rõ ràng: Phôi cơ thể, Mái tóc, Áo giáp, Quần.
  - Hộp chọn bảng màu (Color Picker Dropdown) kế bên mỗi layer: ví dụ chọn Tóc (Nâu / Vàng / Đỏ / Đen), Áo giáp (Thép xanh / Vàng kim / Đỏ thắm).
- **Bộ Xem Trước Thời Gian Thực**:
  - Khi người dùng đổi màu hoặc bật/tắt layer, trình phát preview 64x64 sẽ tự động ghép và cập nhật ngay lập tức.
- **Nút Chuyển Sang AI Studio**:
  - Tự động ghép dải ảnh chứa toàn bộ các layer đã chọn màu.
  - Tự động sinh Prompt gợi ý phản ánh đúng trang phục và màu sắc đã phối (ví dụ: `warrior, brown hair, golden plate armor, leather pants`).
  - Đưa sang AI Studio với `strength = 0.32` cố định để Re-skin mượt mà 100%.

---

## 3. Luồng Hoạt Động (Data Flow)

```
[Người dùng chọn Phụ Kiện & Bảng Màu trong LPC Studio]
        │
        ▼
[LpcCompositor: Ghép Layer Z-Order + Đổi Màu Palette Ramps]
        │
        ├─────────────────────────────────────────┐
        ▼                                         ▼
[Lựa chọn 1: Xuất Sprite Sheet Trực Tiếp]   [Lựa chọn 2: Chuyển Sang AI Studio]
- Xuất PNG dải hoặc sheet 64x64              - Dải phôi chuyển sang đã có đủ Tóc + Áo + Quần
- Nhập vào Timeline / Canvas Studio         - AI Img2Img Re-skin ở strength = 0.30 - 0.32
- Dùng trực tiếp cho game 2D                - Kết quả: Pixel Art 16-bit sắc nét, đồng bộ 100%
```

---

## 4. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu

1. **Kiểm thử Palette Recolor**:
   - Đổi tóc từ Nâu sang Vàng và Đỏ: Xác nhận độ sáng bóng và bóng đổ của sợi tóc không bị mất hoặc biến thành mảng bệt.
   - Đổi áo giáp từ Thép sang Vàng kim: Xác nhận ánh sáng viền giáp kim loại được bảo toàn.
2. **Kiểm thử Ghép Đa Tầng (Multi-layer Compositing)**:
   - Cử động bước đi (`walk`), chém (`slash`), bị thương (`hurt`): Xác nhận tóc và tà áo di chuyển ăn khớp theo từng cử động của cơ thể.
3. **Kiểm thử AI Re-skin**:
   - Đưa dải phôi đã có tóc và giáp sang AI Studio, bấm "Sinh Hoạt Cảnh Đồng Bộ":
   - Xác nhận 9/9 khung hình đều có đầy đủ tóc, giáp, quần đồng nhất; không còn hiện tượng người trần hay trọc đầu; không bị nhấp nháy chuyển động.

---

## 5. Xác Nhận Của Người Dùng

Bản đặc tả thiết kế trên đã bao quát toàn bộ yêu cầu triển khai theo Phương Án 1.  
Vui lòng xem qua và cho ý kiến xác nhận để chuyển sang bước lập kế hoạch thực thi chi tiết.

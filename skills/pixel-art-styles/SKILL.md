---
name: pixel-art-styles
description: Use when creating, generating, editing, or rendering 16-bit and retro pixel art, character spritesheets, portraits, item icons, tilesets, or training pixel art AI models
---

# Kỹ Năng Đồ Họa Pixel Art Toàn Diện (pixel-art-styles)

## Tổng Quan (Overview)
Kỹ năng này cung cấp toàn bộ tri thức thẩm mỹ, quy chuẩn kỹ thuật và bộ dữ liệu phong cách pixel art chuyên nghiệp cho game và hội họa số (bao gồm các phong cách cổ điển, chân dung hội thoại, chibi hoạt họa, hiệp sĩ giả tưởng, nông sản vật phẩm và hiệu ứng hoạt cảnh).

Kỹ năng phục vụ 2 mục đích chính:
1. **Chỉ dẫn AI vẽ Pixel Art chuẩn xác:** Điều khiển công cụ MCP `pixel-draw-mcp` hoặc sinh mã canvas/ma trận theo chuẩn pixel art sắc nét.
2. **Quy trình huấn luyện AI (AI Training Workflow):** Hướng dẫn đóng gói dataset và fine-tune mô hình AI (LoRA SD1.5 / SDXL / Flux).

---

## Khi Nào Sử Dụng (When to Use)
- Yêu cầu vẽ hoặc sửa sprite nhân vật, thú nuôi, quái vật, nông sản, đạo cụ hoặc bản đồ trong Pixel Draw.
- Thiết kế chuỗi hoạt cảnh đa khung hình: Bước đi (walk cycle 4 hướng), nhịp thở (idle), vung kiếm, cây lớn dần qua 5 giai đoạn, cá bơi, thức ăn bốc khói.
- Tạo bộ chân dung hội thoại 64x64 pixel đa biểu cảm (vui, buồn, giận, ngượng, ngạc nhiên).
- Cần bộ màu chuẩn xác (Hex palettes) được tinh chọn cho game 16-bit.
- Chuẩn bị dữ liệu để huấn luyện LoRA / Fine-tune mô hình trí tuệ nhân tạo.

---

## 1. 5 Quy Tắc Vàng Tạo Hình Pixel Art (Core Principles)

1. **Góc nhìn Top-down 3/4 và Trực diện:** Mặt trước và mặt trên của vật thể hiển thị đồng thời ở góc chếch hoặc trực diện 2D. Giữ tỷ lệ lưới điểm ảnh đồng đều.
2. **Đường viền hòa sắc (Selective Outlining - Sel-out):**
   - Hạn chế dùng viền đen tuyền `#000000` trên các đối tượng sống và tự nhiên.
   - Dùng màu nâu sẫm hữu cơ `#3a2010` hoặc màu tối của vật thể làm viền bao ngoài.
   - Các viền chi tiết bên trong dùng màu tối hơn của mảng tiếp giáp (ví dụ viền áo dùng màu vải tối).
3. **Đổ bóng mảng cụm (Cluster Shading):**
   - Ánh sáng chiếu từ góc trên bên trái xuống.
   - Sử dụng từ 3 đến 4 sắc độ màu cho mỗi đối tượng: Điểm sáng (Highlight) -> Màu chính (Base) -> Bóng đổ (Shadow) -> Đường chân (Deep shadow).
   - Hạn chế tối đa dither hạt caro li ti; giữ các cụm màu liền mạch.
4. **Dịch chuyển sắc tướng (Hue-Shifting):**
   - Vùng sáng chuyển dần về tông màu vàng/cam ấm.
   - Vùng tối chuyển dần về tông tím/xanh lạnh hoặc nâu đỏ trầm.
5. **Kích thước chuẩn hóa theo hệ lưới:**
   - Biểu tượng, dụng cụ, hạt giống, ô đất: 16x16 pixel.
   - Nhân vật NPC, quái vật thông thường: 16x32 pixel hoặc 32x32 pixel.
   - Động vật lớn, công trình: 32x32 pixel, 64x64 pixel hoặc bội số của 16.
   - Chân dung đối thoại (Portraits): 64x64 pixel hoặc 128x128 pixel.

---

## 2. Thư Viện Các Phong Cách Chi Tiết (Style Profiles)

Kỹ năng chứa 6 hồ sơ phong cách chuyên biệt trong thư mục `styles/`:
- [`classic_vanilla.md`](styles/classic_vanilla.md): Phong cách nguyên bản mộc mạc, tỷ lệ nhân vật 16x32, màu sắc tự nhiên dưới ánh nắng.
- [`expanded_portraits.md`](styles/expanded_portraits.md): Chân dung đối thoại 64x64 chi tiết cao, mái tóc bồng bềnh và biểu cảm sắc sảo.
- [`seasonal_cute_chibi.md`](styles/seasonal_cute_chibi.md): Phong cách Chibi mắt to, má hồng, biến đổi trang phục theo bối cảnh.
- [`fantasy_medieval.md`](styles/fantasy_medieval.md): Phong cách hiệp sĩ giả tưởng, giáp kim loại bóng, vũ khí phát sáng, quặng phát quang huyền bí.
- [`crops_flora.md`](styles/crops_flora.md): Hệ thống cây trồng và thực vật với chu kỳ sinh trưởng 5 giai đoạn.
- [`animated_items_fx.md`](styles/animated_items_fx.md): Hoạt cảnh vi mô lặp 2-8 frame cho vật phẩm, thức ăn bốc khói, slime nảy nhót, ngọc lấp lánh.

---

## 3. Bảng Màu Chuẩn (Palettes Reference)

Bảng mã màu chi tiết lưu tại [`palettes/palettes.json`](palettes/palettes.json). Các nhóm màu quan trọng nhất:
- **Viền ngoài:** `#3a2010` (Nâu sẫm hữu cơ), `#2d1624` (Mận sẫm).
- **Màu da sáng:** Highlight `#fff5eb`, Màu chính `#fcd0a1`, Đổ bóng `#d99768`, Chân viền `#8f563b`.
- **Đất cày:** `#4a2d18` (đậm), `#6e4423` (vừa), `#966136` (sáng).
- **Gỗ:** `#633c1f` (viền gỗ), `#8f5b32` (thân gỗ), `#b88351` (vân sáng), `#deb887` (bắt sáng).
- **Lá mùa xuân:** `#1e3f20` (bóng), `#386b2e` (lá chính), `#5c9e3d` (lá sáng), `#8fcf4f` (đọt non).
- **Kim loại quý & phát quang:** `#2e1240` (tím đen), `#5e2980` (tím vừa), `#9f4cc4` (tím sáng), `#f59eff` (tím phát quang).

---

## 4. Hướng Dẫn Huấn Luyện AI (AI Training Guide)

Để huấn luyện một mô hình AI tạo ảnh Pixel Art (như SD1.5, SDXL hoặc Flux):

### Bước 1: Lọc và Phân Loại Dataset
Chia thư mục thành 4 tập dữ liệu con độc lập:
1. `dataset_portraits`: Các ảnh chân dung 64x64 hoặc phóng đại lên 512x512 bằng phương pháp Nearest-Neighbor.
2. `dataset_characters`: Các spritesheet nhân vật được cắt ra từng frame riêng biệt.
3. `dataset_crops_items`: Các icon 16x16 phóng to Nearest-Neighbor lên 512x512.
4. `dataset_tilesets`: Các mảng gạch ô đất và cảnh quan.

### Bước 2: Tự Động Gắn Nhãn (Captioning)
Sử dụng script [`scripts/prepare_lora_dataset.py`](scripts/prepare_lora_dataset.py) để sinh file `.txt` tương ứng cho từng file ảnh với từ khóa kích hoạt:
```text
pixel art, 16-bit RPG, clean cluster shading, organic outline
```

### Bước 3: Cấu Hình Huấn Luyện LoRA
- **Kiến trúc mô hình gốc:** Stable Diffusion 1.5, SDXL hoặc Flux.
- **Network Rank (Dim):** 32 hoặc 64 (Alpha = 16 hoặc 32).
- **Learning Rate:** `1e-4` (cho U-Net) và `5e-5` (cho Text Encoder).
- **Optimizer:** AdamW8bit hoặc Prodigy.
- **Resolution:** 512x512 (ảnh pixel art đã upscaled bằng Nearest Neighbor).
- **Epochs:** 10 - 15 epochs.

---

## 5. Các Lỗi Phổ Biến Cần Tránh (Common Mistakes)

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Dùng viền đen `#000000` | Quen tay vẽ viền truyện tranh | Thay bằng màu nâu sẫm `#3a2010` hoặc phiên bản màu tối hơn của vật thể |
| Đường nét bị gãy (Jaggies) | Độ dài bước pixel không đều (3-1-3) | Chuẩn hóa chuỗi bước pixel: 3-2-1-1-2-3 |
| Viền kép thừa (Doubles) | Hai pixel góc dính chéo tạo góc 2px | Xóa bớt 1 pixel thừa ở góc nhọn |
| Dither hạt caro quá dày | Cố gắng tạo chuyển màu trên diện tích nhỏ | Đổ bóng theo mảng cụm phẳng (Cluster Shading) |
| Nhân vật bị trôi lệch khi bước đi | Điểm neo (Pivot point) không cố định | Cố định tọa độ tâm chân ở đáy canvas giữa các khung hình |

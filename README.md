# Pixel Draw

Hệ sinh thái đồ họa Pixel Art và Hoạt cảnh Nhân vật (Character Spritesheet) tích hợp trí tuệ nhân tạo thông qua giao thức Model Context Protocol (MCP) và Stable Diffusion.

Dự án cho phép AI sinh ảnh pixel art trực tiếp, đồng bộ theo thời gian thực (realtime qua WebSocket) lên Studio web, quản lý Layer, phóng to bám tâm chuột, xoay/lật/chọn vùng, và xuất SpriteSheet chuẩn Game Engine (Phaser, Unity, Godot).

---

## 1. Cài Đặt Nhanh Trọn Gói (1-Click All-in-One Setup)

Đối với người dùng mới clone dự án về máy:

### Cách 1: Chạy file cài đặt tự động (Khuyến nghị trên Windows)

Chỉ cần **nhấp đúp chuột** vào file **`setup.bat`** (hoặc chạy trong terminal):

```cmd
setup.bat
```

Hoặc trên PowerShell:
```powershell
.\setup.ps1
```

Trình cài đặt tự động sẽ thực hiện toàn bộ 5 bước:
1. Kiểm tra môi trường Node.js (>= 18) và Python (>= 3.10).
2. Tự động chạy `npm install` cài đặt dependencies cho toàn bộ monorepo.
3. Khởi tạo môi trường ảo Python `.venv` và cài đặt các thư viện AI từ `requirements.txt`.
4. Tự động kiểm tra và tải các mô hình AI Checkpoint & LoRA nặng từ Hugging Face.
5. Biên dịch mã nguồn monorepo (`npm run build`).

---

### Cách 2: Cài đặt thủ công từng bước

Nếu muốn tự kiểm soát từng bước qua dòng lệnh:

```bash
# 1. Cài đặt các gói phụ thuộc Node.js
npm install

# 2. Tạo môi trường ảo Python và cài đặt thư viện AI
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt

# 3. Tự động tải các Model AI cần thiết
.venv\Scripts\python scripts/download_models.py

# 4. Biên dịch toàn bộ các gói trong dự án
npm run build
```

---

## 2. Bảng Mô Hình AI & Tải Thủ Công (AI Models)

Các file mô hình AI có dung lượng lớn (> 100MB) được cấu hình trong `.gitignore` để không đẩy lên GitHub. Nếu đường truyền mạng tự động gặp gián đoạn, bạn có thể tải trực tiếp từ trình duyệt hoặc phần mềm download (IDM, Aria2):

| Tên mô hình | Loại | Dung lượng | Vị trí lưu trữ trong dự án | Liên kết tải trực tiếp (Hugging Face) |
|---|---|---|---|---|
| **AbyssOrangeMix3 (AOM3A1B)** | Checkpoint SD1.5 | ~2.13 GB | `models/checkpoints/AOM3A1B_orangemixs.safetensors` | [Tải từ Hugging Face](https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors) |
| **Pixel F2** | LoRA đa phong cách | ~151 MB | `models/lora/pixel_f2.safetensors` | [Tải từ Hugging Face](https://huggingface.co/zenafey/pixel_f2/resolve/main/pixel_f2.safetensors) |
| **Pixel Portrait** | LoRA chân dung | ~3.2 MB | `models/lora/pixel_portrait_lora.safetensors` | *(Đã có sẵn trong mã nguồn Git)* |

> **Mẹo:** Bạn có thể chạy lệnh sau bất kỳ lúc nào để script tự động kiểm tra tính toàn vẹn và tải những model còn thiếu:
> ```bash
> npm run download:models
> ```

---

## 3. Khởi Động Dự Án

### Khởi động nhanh bằng 1-Click:
Nhấp đúp chuột vào file **`start.bat`**. 
Script sẽ tự động khởi động Backend WebSocket Bridge, Web Studio và tự động mở trình duyệt tại `http://localhost:5173`.

### Hoặc khởi động qua dòng lệnh:
```bash
# Chạy đồng thời cả Server WebSocket Bridge và Studio Web App
npm run dev

# Hoặc chạy riêng từng dịch vụ:
npm run dev:server   # WebSocket Bridge tại http://127.0.0.1:3055
npm run dev:studio   # Studio UI tại http://127.0.0.1:5173
```

Khi mở giao diện tại `http://localhost:5173`, thanh trạng thái góc trên sẽ hiển thị `Bridge: Online`.

---

## 4. Kiến Trúc Dự Án (Monorepo)

- **`apps/studio/`**: Ứng dụng web Single Page Application (Vite + TypeScript + Canvas) với giao diện Dark Mode hiện đại:
  - Công cụ vẽ: Bút chì (1-4px), Tẩy, Đổ màu (Flood Fill), Đường thẳng Bresenham, Khung chữ nhật, Hình tròn Midpoint, Tô caro (Dither), Tăng/giảm độ sáng, Đối xứng gương.
  - Quản lý Layer nâng cao: Thêm/xóa/đổi tên layer (Inline Rename), gom nhóm thư mục (Group Folders), ẩn/hiện, gộp layer (`Ctrl + E`), nhân vùng chọn sang layer mới (`Ctrl + J`).
  - Viewport Canvas: Phóng to thu nhỏ bám tâm chuột, di chuyển khung tranh mượt mà bằng phím Space hoặc chuột giữa.
  - Tích hợp AI Studio SD1.5 & LoRA: Sinh ảnh pixel thời gian thực kèm thanh tiến trình từng bước (`Step X/N`, phần trăm, thời gian đã chạy và ETA).
- **`apps/server/`**: Máy chủ cục bộ Node.js kết hợp WebSocket Bridge (Cổng 3055) và bộ xuất ảnh Nearest Neighbor (hệ số phóng đại 1x đến 16x, xuất SpriteSheet và file JSON metadata chuẩn Game Engine).
- **`apps/mcp/`**: Máy chủ Stdio MCP Server cung cấp 10 công cụ tiêu chuẩn để trợ lý AI (Antigravity, Claude Desktop) vẽ trực tiếp lên Studio.
- **`skills/pixel-artist/`**: Bộ kỹ năng AI dạng mô-đun gồm các Hồ sơ Phong cách (`styles/`: 16-bit, 8-bit, Chibi, Cyberpunk, Lineless, Cozy Farming) và Khung xương chuyển động (`templates/`).
- **`skills/pixel-art-styles/`**: Thư viện tri thức pixel art mở rộng (bảng màu palettes, chu kỳ tăng trưởng nông sản, dải biểu cảm chân dung, hoạt cảnh bước đi).
- **`packages/shared-types/`**: Kiểu dữ liệu TypeScript dùng chung cho toàn bộ monorepo.

---

## 5. Danh Mục Công Cụ MCP (Model Context Protocol)

1. `create_canvas`: Tạo canvas mới với kích thước và tên sprite.
2. `get_canvas_state`: Lấy thông tin kích thước, layers, clips và ma trận điểm ảnh hiện có.
3. `draw_matrix`: Vẽ nhanh ma trận pixel bằng chuỗi ký tự và bảng mã màu Hex.
4. `draw_pixels`: Chấm hoặc sửa các pixel lẻ.
5. `draw_shape`: Vẽ đường thẳng, hình chữ nhật, hình tròn.
6. `flood_fill`: Đổ màu cho một vùng liên thông.
7. `create_animation_clip`: Tạo nhãn động tác hoạt cảnh (`idle`, `walk`, v.v.).
8. `draw_animation_frame`: Vẽ khung hình cụ thể trong clip hoạt cảnh.
9. `copy_frame_with_offset`: Nhân bản khung hình kèm độ lệch tọa độ tạo nhịp thở hoặc bước chân.
10. `export_spritesheet`: Xuất ảnh PNG SpriteSheet và file JSON metadata trực tiếp vào thư mục dự án đích.

---

## 6. Sinh Ảnh Pixel Art Bằng Dòng Lệnh Python

Ngoài việc sinh ảnh trực tiếp trên giao diện Studio Web, bạn có thể chạy script độc lập:

```bash
# Sinh nhân vật RPG bằng LoRA pixel_f2
.venv\Scripts\python scripts/generate_pixel_art.py --lora models/lora/pixel_f2.safetensors --prompt "pixel art, 16-bit rpg hero, warrior knight, golden armor, sword in hand, full body, simple white background" --steps 18 --size 64 --output_prefix storage/outputs/hero_pixel

# Sinh chân dung 64x64 bằng LoRA Pixel Portrait
.venv\Scripts\python scripts/generate_pixel_art.py --lora models/lora/pixel_portrait_lora.safetensors --prompt "pixel art, character portrait, 1girl, purple hair, smiling, simple white background" --steps 16 --size 64 --output_prefix storage/outputs/portrait_pixel
```

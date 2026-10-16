# drawing-pixel

Hệ sinh thái đồ họa Pixel Art và Hoạt cảnh Nhân vật (Character Spritesheet) tích hợp trí tuệ nhân tạo thông qua giao thức Model Context Protocol (MCP).

Dự án cho phép AI vẽ trực tiếp lên Studio theo thời gian thực (realtime qua WebSocket) hoặc kết xuất ảnh không cần giao diện (Headless) vào các dự án game và web, sau đó người dùng có thể dùng chuột hoặc bút vẽ để chỉnh sửa tiếp trên trình duyệt.

---

## 1. Kiến Trúc Dự Án (Monorepo)

- **`apps/studio/`**: Ứng dụng web Single Page Application (Vite + TypeScript + HTML5 Canvas) lấy cảm hứng từ PixAssets Studio với giao diện Dark theme hiện đại.
  - Hỗ trợ đầy đủ công cụ vẽ pixel: Bút chì (1-4px), Tẩy, Thùng sơn (Flood Fill), Đoạn thẳng Bresenham, Khung chữ nhật, Đường tròn Midpoint, Tô họa tiết caro (Checker Dither), Tăng/giảm độ sáng (Lighten/Darken), Đối xứng gương trục dọc/ngang.
  - Bảng màu: Tích hợp sẵn Endesga 32, Pico-8, Game Boy Classic, DawnBringer 16.
  - Quản lý Layers và Timeline hoạt cảnh: Phân nhóm theo nhãn (Animation Clips: `idle`, `walk`, `attack`), lớp bóng mờ Onion Skinning phân biệt màu (đỏ cho trước, xanh cho sau), cửa sổ xem trước Mini Preview Player.
- **`apps/server/`**: Máy chủ cục bộ Node.js kết hợp WebSocket Bridge (Cổng 3055) và bộ kết xuất ảnh Nearest Neighbor sắc nét (hệ số phóng đại 1x đến 16x, xuất SpriteSheet và file JSON metadata chuẩn Game Engine).
- **`apps/mcp/`**: Máy chủ Stdio MCP Server cung cấp 10 công cụ chuẩn hóa cho AI.
- **`skills/pixel-artist/`**: Bộ kỹ năng AI dạng mô-đun mở rộng gồm các Hồ sơ Phong cách (`styles/`: 16-bit, 8-bit, Chibi, Cyberpunk Sci-Fi, Lineless, Custom) và Khung xương hoạt cảnh (`templates/`: nhịp thở, bước đi, giật súng, vung kiếm).
- **`packages/shared-types/`**: Thư viện định nghĩa kiểu dữ liệu dùng chung (TypeScript types & interfaces).

---

## 2. Hướng Dẫn Cài Đặt Và Chạy Cục Bộ

### Yêu cầu hệ thống:
- Node.js phiên bản 18 trở lên.
- Trình quản lý gói npm (hoặc pnpm / yarn).

### Các bước khởi động:
```bash
# 1. Cài đặt các gói phụ thuộc cho toàn bộ monorepo
npm install

# 2. Chạy đồng thời cả Server WebSocket Bridge và Studio Web App
npm run dev

# Hoặc chạy riêng từng thành phần:
npm run dev:server   # Chạy WebSocket Bridge tại http://127.0.0.1:3055
npm run dev:studio   # Mở Studio tại http://127.0.0.1:5173
```

Khi mở `http://127.0.0.1:5173`, mục trạng thái phía trên sẽ hiển thị `Bridge: Online`.

---

## 3. Danh Mục Công Cụ MCP (Model Context Protocol)

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

## 4. Tích Hợp Custom Skill `pixel-artist`

Để sử dụng skill này trong Antigravity hoặc Claude:
1. Sao chép thư mục `skills/pixel-artist` vào thư mục Global Skills của bạn:
   - Đường dẫn: `C:\Users\<Tên_Người_Dùng>\.gemini\config\skills\pixel-artist`
2. Cấu hình MCP Server trong tệp `mcp_config.json`:
   ```json
   {
     "mcpServers": {
       "pixel-draw": {
         "command": "node",
         "args": ["d:/pixel_draw/apps/mcp/dist/index.js"]
       }
     }
   }
   ```
3. Trong bất kỳ phiên chat nào, chỉ cần gọi:
   > *"Dùng skill /pixel-artist vẽ cho tôi nhân vật hiệp sĩ 24x24 theo phong cách 16bit-classic có động tác idle và walk"*

---

## 5. Mô Hình AI Tạo Ảnh Pixel Art (Stable Diffusion & LoRA)

Dự án hỗ trợ sinh ảnh nhân vật và bối cảnh Pixel Art bằng Stable Diffusion kết hợp với mô hình LoRA `pixel_f2`.

### Tải Checkpoint Khuyến Nghị (AbyssOrangeMix 3 A1B)

Để LoRA `pixel_f2` đạt chất lượng pixel sắc nét chuẩn 2D như trên Civitai (không bị nhòe hay méo hình), bắt buộc sử dụng checkpoint nền tảng **AbyssOrangeMix 3 A1B (AOM3A1B)**:

- **Liên kết tải trực tiếp:**
  [https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors](https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors)
- **Thư mục lưu trữ:** `models/checkpoints/AOM3A1B_orangemixs.safetensors`
- **Dung lượng:** Khoảng 2.13 GB (bản pruned fp16 tối ưu).

#### Lệnh tải nhanh bằng PowerShell:
```powershell
# Tao thu muc checkpoints neu chua co
New-Item -ItemType Directory -Force -Path "models/checkpoints"

# Tai tep mo hinh ve may
Invoke-WebRequest -Uri "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors" -OutFile "models/checkpoints/AOM3A1B_orangemixs.safetensors"
```

#### Lệnh tải bằng curl:
```bash
curl -L -o models/checkpoints/AOM3A1B_orangemixs.safetensors "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors"
```

### Thiết Lập Và Sinh Ảnh Cục Bộ

1. Cài đặt các gói phụ thuộc Python vào môi trường ảo:
   ```powershell
   .venv\Scripts\pip install -r requirements.txt
   ```

2. Sinh ảnh Pixel Art bằng LoRA `pixel_f2`:
   - Trigger word chính: `pixel`, `chibi`
   - Trọng số LoRA khuyến nghị: `0.5` đến `0.6`
   - Lệnh mẫu:
     ```powershell
     .venv\Scripts\python scripts/th_generate_stardew_portrait.py --lora models/lora/pixel_f2.safetensors --prompt "pixel, chibi, 1boy, solo, armor, holding sword, brown hair, blue eyes, full body, standing, simple background, white background" --steps 18 --size 64 --output_prefix storage/outputs/th_character_pixel
     ```


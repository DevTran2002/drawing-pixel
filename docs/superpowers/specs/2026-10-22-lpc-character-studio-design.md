# Tài Liệu Đặc Tả Kỹ Thuật: Hệ Thống LPC Character Studio & Motion Rig

- Ngày lập: 2026-10-22
- Tác giả: Đội ngũ phát triển Pixel Draw
- Trạng thái: Đã thống nhất thiết kế (Approved Draft)
- Phạm vi: Tích hợp phân hệ tạo nhân vật đa tầng chuẩn LPC kết hợp AI Studio vào Pixel Draw Monorepo

---

## 1. Mục Tiêu & Tổng Quan Kiến Trúc

### 1.1. Mục tiêu
Xây dựng phân hệ **LPC Character Studio** bên trong ứng dụng Web Studio của `pixel_draw`, cho phép:
1. Khai thác trọn vẹn bộ phôi cơ thể chuẩn Universal LPC Spritesheet (`832 x 3456 pixel`, 54 hàng x 13 cột, mỗi ô `64 x 64 pixel`) làm khung xương chuyển động chuẩn.
2. Ghép nối nhân vật đa tầng theo mô hình Paper Doll thời gian thực (Cơ thể, Mắt, Tóc, Quần áo, Vũ khí) với thứ tự chiều sâu (Z-Order) chuẩn mực.
3. Cung cấp tính năng AI Pose Re-skinning: Dùng các khung hình phôi làm tư thế dẫn hướng (Pose Reference) cho mô hình Stable Diffusion 1.5 và LoRA Pixel F2 để tạo ra các nhân vật mang phong cách mới lạ nhưng giữ nguyên 100% chuyển động và tỷ lệ cơ thể.
4. Tích hợp liền mạch với Timeline, Layer Canvas và Thư viện tài nguyên (Asset Browser) sẵn có của Pixel Draw Studio.

### 1.2. Sơ đồ luồng dữ liệu tổng quát
```
[Bộ phôi sprites.png (832x3456)] + [Kho phụ kiện LPC (Hair, Clothes, Weapons)]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        LPC Matrix & Slicing Engine           │
        │   - Ánh xạ 54 hàng động tác và 4 hướng nhìn  │
        │   - Trích xuất ô 64x64 pixel với Pivot chuẩn │
        └──────────────────────┬───────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Paper Doll Compositor (2D)  │ │  AI Pose Re-skinning Engine  │
│  - Xếp lớp theo Z-Order      │ │  - SD1.5 + LoRA Pixel F2     │
│  - Live Preview 4 hướng      │ │  - Prompt + Denoise 0.55     │
│  - Điều chỉnh FPS động       │ │  - Làm sạch dải màu pixel    │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
               └──────────────┬─────────────────┘
                              ▼
        ┌──────────────────────────────────────────────┐
        │         Cầu Nối Đồng Bộ Hóa Studio           │
        │  1. Nạp khung hình vào Canvas (Layer Data)   │
        │  2. Nạp hoạt cảnh vào Timeline (Clips)       │
        │  3. Lưu vào Thư viện tài nguyên dự án        │
        │  4. Xuất Spritesheet Atlas (PNG + JSON)      │
        └──────────────────────────────────────────────┘
```

---

## 2. Đặc Tả Ma Trận LPC 54 Hàng (LPC Matrix Specification)

### 2.1. Cấu hình lưới
- Kích thước ảnh nguồn: Chiều rộng `832px`, Chiều cao `3456px`.
- Kích thước ô đơn vị (Cell Dimension): `64px x 64px`.
- Số cột tối đa: 13 cột.
- Số hàng: 54 hàng.
- Tọa độ điểm neo (Pivot Point): `x = 32, y = 63` (chính giữa đáy khung hình, tương ứng vị trí tiếp đất của bàn chân).

### 2.2. Bảng phân bổ 54 hàng hoạt cảnh chuẩn
| Dải hàng | Tên hành động | Số hướng | Số khung hình/hướng | Tốc độ FPS khuyến nghị | Vòng lặp (Loop) | Mô tả |
|---|---|---|---|---|---|---|
| Hàng 0 - 3 | Spellcast | 4 (Up, Left, Down, Right) | 7 frames | 8 FPS | false | Động tác niệm phép, giơ tay niệm chú |
| Hàng 4 - 7 | Thrust | 4 (Up, Left, Down, Right) | 8 frames | 10 FPS | false | Động tác đâm giáo hoặc đâm kiếm thẳng |
| Hàng 8 - 11 | Walk Cycle | 4 (Up, Left, Down, Right) | 9 frames | 10 FPS | true | Bước đi chuẩn (Frame 0: Đứng im, Frame 1-8: Bước chân) |
| Hàng 12 - 15 | Slash | 4 (Up, Left, Down, Right) | 6 frames | 12 FPS | false | Vung kiếm chém ngang |
| Hàng 16 - 19 | Shoot | 4 (Up, Left, Down, Right) | 13 frames | 12 FPS | false | Rút tên, giương cung và bắn |
| Hàng 20 | Hurt / Fall | 1 (Down) | 6 frames | 8 FPS | false | Bị trúng đòn, ngã quỵ xuống đất |
| Hàng 21 - 24 | Climb | 4 (Up, Left, Down, Right) | 6 frames | 8 FPS | true | Leo thang hoặc trèo tường |
| Hàng 25 - 28 | Sit | 4 (Up, Left, Down, Right) | 3 frames | 4 FPS | true | Ngồi nghỉ ngơi hoặc ngồi ghế |
| Hàng 29 - 32 | Jump | 4 (Up, Left, Down, Right) | 5 frames | 10 FPS | false | Nhảy lên và tiếp đất |
| Hàng 33 - 36 | Run | 4 (Up, Left, Down, Right) | 8 frames | 14 FPS | true | Chạy nhanh sải bước dài |
| Hàng 37 - 40 | Combat Idle | 4 (Up, Left, Down, Right) | 4 frames | 6 FPS | true | Tư thế thủ thế sẵn sàng chiến đấu |
| Hàng 41 - 53 | Extended Poses | Đa hướng | 3 - 6 frames | 8 FPS | false | Các tư thế mở rộng: Phòng thủ khiên, ngã bất tỉnh, xoay người |

---

## 3. Cấu Trúc Dữ Liệu TypeScript

### 3.1. Định nghĩa mô-đun LPC Matrix (`apps/studio/src/lpc/lpc-matrix.ts`)
```typescript
// Cac huong nhin tieu chuan
export type LpcDirection = 'up' | 'left' | 'down' | 'right';

// Dinh nghia thong tin mot hang hanh dong trong bang LPC 54 hang
export interface LpcActionRow {
  actionId: string;
  actionName: string;
  direction: LpcDirection;
  rowIndex: number;
  frameCount: number;
  fps: number;
  loop: boolean;
}

// Dinh nghia mot nhom hoat canh hoan chinh (gom du 4 huong)
export interface LpcActionGroup {
  id: string;
  name: string;
  description: string;
  directions: Record<LpcDirection, {
    rowIndex: number;
    frameCount: number;
  }>;
  defaultFps: number;
  loop: boolean;
}
```

### 3.2. Định nghĩa cấu hình nhân vật ghép lớp (`apps/studio/src/lpc/lpc-types.ts`)
```typescript
export type LpcLayerCategory = 'shadow' | 'body' | 'head' | 'torso' | 'legs' | 'hair' | 'weapons';

export interface LpcAssetItem {
  id: string;
  name: string;
  category: LpcLayerCategory;
  zIndex: number;
  imageUrl: string;
  imageElement?: HTMLImageElement;
  tintColor?: string;
  enabled: boolean;
}

export interface LpcCharacterStudioState {
  characterName: string;
  layers: LpcAssetItem[];
  currentActionId: string;
  currentDirection: LpcDirection;
  currentFrameIndex: number;
  isPlaying: boolean;
  fps: number;
  zoomScale: number;
}
```

---

## 4. Trình Ghép Lớp Đồ Họa (Paper Doll Compositor)

### 4.1. Quy tắc phân tầng Z-Order nghiêm ngặt
Khi ghép nhiều dải hình ảnh lên khung hình kích thước 64x64, thứ tự vẽ bắt buộc phải tuân theo chỉ số `zIndex`:
1. `zIndex = 10`: **Bóng đổ tiếp đất (Shadow)** - Nằm dưới cùng tại điểm neo chân.
2. `zIndex = 20`: **Khung phôi cơ thể (Base Body)** - File ảnh `sprites.png`.
3. `zIndex = 30`: **Khuôn mặt & Mắt (Eyes & Expressions)**.
4. `zIndex = 40`: **Quần & Giày dép (Pants & Boots)**.
5. `zIndex = 50`: **Áo sơ mi & Giáp ngực (Torso & Armor)**.
6. `zIndex = 60`: **Tóc & Mũ nón bảo hộ (Hair & Helmet)**.
7. `zIndex = 70`: **Vũ khí chính & Khiên (Weapon & Shield)**.

### 4.2. Cơ chế Render thời gian thực & Tối ưu hiệu năng
- **Offscreen Buffer:** Mỗi lần chuyển frame hoặc đổi hướng, thuật toán vẽ lần lượt các layer đang kích hoạt (`enabled = true`) vào một Offscreen Canvas kích thước `64x64`.
- **Interpolation:** Thiết lập `imageSmoothingEnabled = false` trên Canvas context để giữ độ sắc cạnh hoàn hảo của từng điểm ảnh pixel art khi phóng đại lên 2x, 3x, 4x trên giao diện Studio.
- **Cache quản lý ảnh:** Toàn bộ đối tượng `HTMLImageElement` của các phụ kiện được tải trước (Preloaded) và lưu trong RAM, tránh đọc lại file từ đĩa gây hiện tượng khựng khung hình khi phát hoạt cảnh.

---

## 5. Mô-Đun AI Pose Re-skinning

### 5.1. Nguyên lý vận hành
Khi người dùng muốn biến đổi một hoạt cảnh thành phong cách độc lạ (quái vật ngoài hành tinh, hiệp sĩ ma, chiến binh cyberpunk):
1. **Dữ liệu mốc (Pose Guide):** Trích xuất khung hình ghép hiện tại của LPC (đã có đủ phôi cơ thể và dáng cử động).
2. **Tham số sinh ảnh AI:**
   - Model Checkpoint: `models/checkpoints/AOM3A1B_orangemixs.safetensors`.
   - LoRA: `models/lora/pixel_f2.safetensors` (Trọng số `0.85`).
   - Phương thức: Img2Img với ảnh mốc là frame 64x64 được upscale nội suy nearest-neighbor lên kích thước model xử lý tối ưu (thường là 512x512 hoặc 256x256), sau đó downscale trở lại 64x64 bằng thuật toán giữ nguyên cụm màu pixel.
   - Denoising Strength: Thiết lập cố định trong dải an toàn `0.52 - 0.62`. Ngưỡng này đảm bảo trang phục và chất liệu được vẽ mới hoàn toàn theo văn bản mô tả nhưng toàn bộ chuyển động tay chân không bị sai lệch.
3. **Bộ lọc hậu kỳ làm sạch màu (Pixel Quantizer):**
   - Hạn chế số màu trong dải màu từ 16 đến 32 màu.
   - Khử nhiễu các điểm ảnh mờ hoặc bán trong suốt ở viền ngoài, bảo đảm tiêu chuẩn Sel-out của pixel art.

---

## 6. Giao Diện Người Dùng & Đồng Bộ Hóa Studio

### 6.1. Thiết kế bảng điều khiển Modal (LPC Studio Modal)
- Nút kích hoạt: `LPC Studio` đặt trên thanh Toolbar trên cùng của giao diện Studio.
- Bố cục 3 cột đồng nhất phong cách Dark Mode:
  - **Cột trái (Kho phụ kiện LPC):** Hiển thị danh mục theo tab: Thân, Tóc, Quần, Áo, Vũ khí. Mỗi mục có checkbox bật/tắt và thumbnail trực quan.
  - **Cột giữa (Live Animation Preview):**
    - Màn hình Canvas xem trước phóng đại 4x có nền caro trong suốt.
    - Bộ 4 nút định hướng (Lên, Xuống, Trái, Phải).
    - Hộp chọn động tác (Dropdown menu danh sách hành động).
    - Thanh trượt điều chỉnh tốc độ khung hình (1 đến 24 FPS) và nút Tạm dừng/Phát tiếp.
  - **Cột phải (Công cụ thao tác & AI):**
    - Khối AI Re-skin: Ô nhập văn bản mô tả (Prompt), thanh chỉnh Denoise, nút "Sinh Hoạt Cảnh Bằng AI".
    - Khối xuất dữ liệu:
      - Nút "Nạp Khung Hình Vào Canvas": Chuyển frame hiện tại thành các Layer trên Canvas chính.
      - Nút "Nạp Hoạt Cảnh Vào Timeline": Tự động tạo `AnimationClip` và đưa toàn bộ các khung hình vào Timeline.
      - Nút "Lưu Vào Asset Browser": Lưu vào thư mục `Assets/Characters/LPC_[Name]` để kéo thả.
      - Nút "Xuất Spritesheet": Tải về file PNG và JSON atlas.

---

## 7. Xử Lý Lỗi & Trường Hợp Biên (Error Handling & Edge Cases)

1. **Thiếu file phụ kiện hoặc đường dẫn lỗi:**
   - Hệ thống tự động bỏ qua layer bị lỗi, hiển thị cảnh báo nhẹ trên giao diện mà không làm treo tiến trình ghép các layer còn lại.
2. **Kích thước file tài nguyên không khớp chuẩn 832x3456:**
   - Kiểm tra kích thước ngay khi nạp ảnh. Nếu tỉ lệ sai khác, đưa ra thông báo yêu cầu ảnh đúng chuẩn lưới LPC 64x64.
3. **Mất kết nối WebSocket tới AI Server:**
   - Tính năng ghép lớp Paper Doll 2D vẫn hoạt động bình thường 100% trên trình duyệt. Nút "Sinh Bằng AI" sẽ tạm thời chuyển sang trạng thái chờ kết nối kèm thông báo trạng thái Bridge Server.

---

## 8. Kế Hoạch Kiểm Thử & Nghiệm Thu (Verification Strategy)

1. **Kiểm thử độ chính xác tọa độ cắt frame:** Cắt thử nghiệm các khung hình tại 4 góc biên (Hàng 0, Hàng 20, Hàng 53, Cột 0, Cột 12) đảm bảo không bị lẹm viền pixel sang ô lân cận.
2. **Kiểm thử tính liên tục của hoạt cảnh:** Chạy chu kỳ Walk Cycle 4 hướng và Slash 4 hướng, quan sát đảm bảo điểm neo chân cố định, không xảy ra hiện tượng rung giật vị trí.
3. **Kiểm thử đồng bộ Studio:**
   - Nhấn "Nạp vào Canvas": Xác nhận các Layer xuất hiện chính xác trên bảng quản lý Layer của Studio và có thể dùng công cụ Bút chì để vẽ tiếp.
   - Nhấn "Nạp vào Timeline": Xác nhận Timeline nhận đủ số lượng frame và phát chuyển động mượt mà.

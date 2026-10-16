# Thiết Kế Đặc Tả: Chế Độ Tạo Hoạt Ảnh Chuyển Động Sprite Bằng AI (AI Sprite Animation Studio)

## 1. Tổng Quan & Mục Tiêu

### 1.1. Bối cảnh
Người dùng cần tạo các bộ Sprite chuyển động hoàn chỉnh cho nhân vật game Pixel Art (bao gồm các hành động: Đi lại, Đánh/Tấn công, Đứng yên, Ngồi, Nằm gục, Chạy, Nhảy). Thách thức lớn nhất trong đồ họa AI Pixel Art là **sự nhất quán về hình dạng, trang phục, màu tóc và khuôn mặt của nhân vật qua từng khung hình (Frame Consistency)**.

### 1.2. Mục tiêu hệ thống
- Cung cấp một chế độ riêng biệt **"Tạo Hoạt Ảnh Sprite" (AI Sprite Animator)** ngay trong Modal AI Studio.
- Quy trình chuẩn 2 bước:
  1. **Bước 1 (Base Character):** Tạo và duyệt ảnh nhân vật mẫu ở tư thế chuẩn để chốt ngoại hình (phong cách, màu tóc, khuôn mặt, giáp trụ, vũ khí).
  2. **Bước 2 (Sprite Generation):** Dựa trên nhân vật mẫu đã chốt, người dùng chọn Hành động và Số khung hình (2, 3, 4, 6, 8 frames), AI tự động sinh chuỗi chuyển động đồng bộ, cắt đều thành các Frame và nạp thẳng vào Timeline của Studio để phát chuyển động.

---

## 2. Luồng Trải Nghiệm Người Dùng (User Workflow)

```
[Người dùng nhập mô tả nhân vật]
                │
                ▼
[Bước 1: Bấm "Vẽ Nhân Vật Mẫu"] ──► AI sinh 1 Base Frame tư thế chuẩn
                │
                ├─► Chưa ưng: Đổi prompt / Bấm vẽ lại
                │
                ▼
[Bấm "Chốt Mẫu & Tiếp Tục"] ──► Lưu Seed, Prompt ngoại hình & Checkpoint
                │
                ▼
[Bước 2: Chọn Hành Động & Số Bước]
  - Hành động: Walk / Attack / Idle / Sit / Defeated / Run / Jump
  - Số bước chuyển động: 2, 3, 4, 6, 8 frames
  - Kích thước xuất: 32x32, 48x48, 64x64 px/frame
                │
                ▼
[Bấm "Tạo Sprite Hoạt Ảnh Bằng AI"]
                │
                ▼
[Backend: Sinh dải SpriteSheet đồng bộ bằng LoRA Pixel F2]
                │
                ▼
[Tự động cắt (Slice) thành N Frames riêng biệt]
                │
                ▼
[Nạp vào Timeline Studio & Khởi tạo AnimationClip]
                │
                ▼
[Trình phát Preview góc phải tự động chạy chuyển động lặp Loop]
```

---

## 3. Danh Sách Hành Động Chuẩn (Action Presets)

Hệ thống hỗ trợ sẵn các nhóm hành động chuẩn sau:

1. **Đi bộ (Walk Cycle - Mặc định 4 frames):**
   - Tag: `character sprite sheet, walk cycle, walking, 4 frames, walking animation`
   - Chu kỳ: Chân trái bước -> Thu chân -> Chân phải bước -> Thu chân.
2. **Tấn công / Vung kiếm (Attack / Slash - 4 frames):**
   - Tag: `action sprite sheet, attacking, swinging sword, slashing, attack animation`
   - Chu kỳ: Thủ thế giơ vũ khí -> Vung chém mạnh -> Thu thế kết thúc.
3. **Đứng yên thở (Idle - 2 đến 4 frames):**
   - Tag: `idle animation, breathing, standing pose, subtle motion`
   - Chu kỳ: Thân người nhấp nhô nhẹ 1 pixel theo nhịp thở.
4. **Ngồi nghỉ (Sit / Resting - 2 frames):**
   - Tag: `sitting, sitting on ground, resting, relaxed pose`
   - Chu kỳ: Ngồi tĩnh hoặc chớp mắt / lắc đầu nhẹ.
5. **Nằm gục / Bị hạ (Defeated / Knockout - 2 frames):**
   - Tag: `lying down, on ground, defeated, knocked out`
   - Chu kỳ: Nằm gục bất động hoặc thở nhẹ.
6. **Chạy nhanh (Run Cycle - 4 đến 6 frames):**
   - Tag: `running animation, run cycle, fast movement, sprinting`
   - Chu kỳ: Độ sải chân dài và độ nghiêng người lớn hơn đi bộ.
7. **Nhảy lên (Jump - 3 frames):**
   - Tag: `jumping, leap, mid-air pose, airborne`
   - Chu kỳ: Nhún chân lấy đà -> Lơ lửng trên không -> Tiếp đất.

---

## 4. Kiến Trúc Kỹ Thuật (Architecture & Components)

### 4.1. Cấu trúc Giao diện Client (`apps/studio`)
- **Tab chuyển đổi trong Modal AI:**
  - Tab 1: `Tạo Ảnh Tĩnh (Static Portrait / Item)`
  - Tab 2: `Tạo Hoạt Ảnh Sprite (Sprite Animator)`
- **Khu vực Bước 1 (Base Character Card):**
  - Khung xem trước ảnh nhân vật mẫu đã chốt (Preview Canvas / Thumbnail).
  - Nút `Chốt Mẫu Này` (Lock Base Frame).
- **Khu vực Bước 2 (Animation Settings Card):**
  - Bộ chọn Hành động (Action Grid / Select).
  - Thanh trượt hoặc nút chọn số khung hình (Frames Count: 2, 3, 4, 6, 8).
  - Tùy chọn Tách nền trong suốt (Remove background to transparent).
  - Nút hành động chính: `Tạo Sprite Hoạt Ảnh Bằng AI`.

### 4.2. Xử lý Cắt Khung Hình (Slicing Engine)
- Khi AI sinh ra một dải ảnh SpriteSheet kích thước ngang (ví dụ: dải 4 frame kích thước tổng `256 x 64` hoặc `128 x 32`):
  - Chiều rộng mỗi frame: `frameWidth = totalWidth / frameCount`.
  - Chiều cao mỗi frame: `frameHeight = totalHeight`.
- Hệ thống bóc tách từng vùng pixel `(i * frameWidth, 0, frameWidth, frameHeight)`:
  - Tự động tạo N phần tử Frame trong `project.frames`.
  - Tạo một `AnimationClip` tương ứng: `{ id: 'clip_walk', name: 'Walk', frameIndices: [0, 1, 2, 3], fps: 8, loop: true }`.
  - Đồng bộ CanvasEngine và HistoryManager.

### 4.3. Backend Service (`apps/server`)
- Bổ sung endpoint `POST /api/ai/generate-sprite-sheet`:
  - Đầu vào:
    ```typescript
    interface GenerateSpriteAnimationPayload {
      basePrompt: string;       // Prompt đặc điểm ngoại hình đã chốt ở Bước 1
      action: string;           // 'walk' | 'attack' | 'idle' | 'sit' | 'defeated' | 'run' | 'jump'
      frameCount: number;       // 2, 3, 4, 6, 8
      seed?: number;            // Seed của ảnh mẫu để giữ nhất quán
      checkpoint?: string;
      loraPath?: string;        // Mặc định models/lora/pixel_f2.safetensors
      loraScale?: number;
      steps?: number;
      size?: number;            // Kích thước mỗi frame (32, 48, 64)
      removeBg?: boolean;
    }
    ```
  - Xử lý:
    - Xây dựng prompt kết hợp:
      `pixel art, simple white background, character sprite sheet, [action_tag], [frameCount] frames sequence, full body, [base_character_features]`
    - Negative prompt chặn phong cảnh:
      `tree, scenery, nature, outdoors, floating island, rocks, ground, grass, mountains, clouds, sky`
    - Tính toán kích thước ảnh sinh ra: `Width = size * frameCount`, `Height = size`.
    - Chạy tiến trình sinh ảnh Python và trả về danh sách các Frame (Pixel Matrix hoặc Base64 Array).

---

## 5. Kế Hoạch Kiểm Thử & Tiêu Chí Thành Công

1. **Giao diện:**
   - Chuyển đổi mượt mà giữa Tab Ảnh tĩnh và Tab Hoạt ảnh Sprite.
   - Hiển thị trực quan khung chốt nhân vật mẫu và thanh chọn số khung hình.
2. **Chất lượng hoạt ảnh:**
   - Nhân vật giữa các frame giữ nguyên màu tóc, trang phục, gương mặt.
   - Tư thế thay đổi nhịp nhàng theo đúng số bước đã chọn.
3. **Tích hợp Timeline:**
   - Sau khi sinh, N frame tự động xuất hiện trên Timeline dưới đáy.
   - Preview Player bên phải phát lặp hoạt ảnh sắc nét theo thuật toán Nearest Neighbor.

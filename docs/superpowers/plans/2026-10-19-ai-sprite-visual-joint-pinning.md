# Kế Hoạch Triển Khai: Gán Khung Xương Thủ Công (Visual Joint Pinning) & Động Học Chuyển Động Mềm

> **Dành cho kỹ sư triển khai:** BẮT BUỘC SỬ DỤNG KỸ NĂNG: Sử dụng `superpowers:subagent-driven-development` (khuyên dùng) hoặc `superpowers:executing-plans` để thực hiện từng nhiệm vụ trong kế hoạch này. Các bước theo dõi bằng cú pháp ô đánh dấu (`- [ ]`).

**Mục tiêu:** Xây dựng tính năng gán khớp xương trực quan (Visual Joint Pinning) bằng cách kéo thả chuột trên ảnh nhân vật mẫu ở Bước 3, kết hợp thuật toán biến dạng khung xương mềm (Soft Skinning Kinematics) để triệt tiêu hoàn toàn lỗi đứt gãy/hở eo pixel và tạo bước đi sinh học mượt mà.

**Kiến trúc:** 
- Giao diện kéo thả 7 điểm ghim khớp (`JointPinningCanvas`) hiển thị trực quan trên canvas 256x256 px tại Bước 3 của Stepper Wizard.
- Thuật toán tự động định vị khớp ban đầu (`autoEstimateSkeletonPins`) dựa trên Bounding Box của nhân vật mẫu.
- Bộ uốn biến dạng điểm ảnh mềm (`SoftSkinningEngine`) trong `apps/server/src/template-animator.ts` tính toán trọng số ảnh hưởng của từng pixel với các đoạn xương, tự động co giãn vùng eo khi thân nhấp nhô và xoay khớp đùi/gối theo chu kỳ bước chân tự nhiên.

**Công nghệ:** TypeScript, HTML5 Canvas API, SVG Overlay, CSS3, Node.js, pngjs.

**Tài liệu đặc tả:** [docs/superpowers/specs/2026-10-19-ai-sprite-visual-joint-pinning-design.md](file:///d:/pixel_draw/docs/superpowers/specs/2026-10-19-ai-sprite-visual-joint-pinning-design.md)

## Ràng Buộc Toàn Cục

- Tuyệt đối không tạo file test tự động theo quy định người dùng (`Not create file test`).
- Không tự động commit git (`Do not auto commit to git`).
- Tên biến, hàm, interface viết bằng tiếng Anh chuẩn (`Use English to name the value`).
- Toàn bộ câu trả lời và chú thích mã nguồn phải là tiếng Việt có dấu (`Alway answer in Vietnamese`, `Alway comment code in Vietnamese`).
- Tuyệt đối không dùng icon hoặc emoji (`Do not use icons or emojis`).
- Không sửa file base của Odoo (`Do not write in file #odoo base`).

---

### Nhiệm Vụ 1: Định Nghĩa Kiểu Dữ Liệu Khung Xương & Đoạn Xương (Skeleton Rig Model)

**Tập tin:**
- Chỉnh sửa: `packages/shared-types/src/index.ts`
- Chỉnh sửa: `apps/server/src/template-animator.ts`

**Giao diện lập trình:**
- Tạo type `JointId = 'head' | 'chest' | 'hips' | 'left_knee' | 'left_foot' | 'right_knee' | 'right_foot' | 'weapon'`
- Tạo interface `JointPin`:
  ```typescript
  export interface JointPin {
    id: JointId;
    name: string;
    x: number;
    y: number;
    parent?: JointId;
    color: string;
  }
  ```
- Tạo interface `SkeletonRig`:
  ```typescript
  export interface SkeletonRig {
    width: number;
    height: number;
    rootJoint: JointId;
    joints: Record<JointId, JointPin>;
    bones: [JointId, JointId][];
  }
  ```
- Cập nhật `TemplateAnimationOptions` trong `template-animator.ts` tiếp nhận trường tùy chọn `skeletonRig?: SkeletonRig`.

- [ ] **Bước 1: Bổ sung các kiểu dữ liệu `JointId`, `JointPin`, `SkeletonRig` vào `packages/shared-types/src/index.ts`**
- [ ] **Bước 2: Xuất khẩu các kiểu dữ liệu mới và cập nhật `apps/server/src/template-animator.ts`**
- [ ] **Bước 3: Biên dịch kiểm tra shared-types bằng `npm run build --prefix packages/shared-types`**

---

### Nhiệm Vụ 2: Nâng Cấp Backend Soft-Skinning & Động Học Bước Chân (Template Animator Engine)

**Tập tin:**
- Chỉnh sửa: `apps/server/src/template-animator.ts`

**Giao diện & Thuật toán:**
- Hàm `autoEstimateSkeletonRig(basePixels: PixelPoint[], width: number, height: number): SkeletonRig`:
  - Quét Bounding Box của nhân vật (`minX, maxX, minY, maxY`).
  - Thiết lập 7 điểm pin chuẩn giải phẫu:
    - `head`: `(centerX, minY + charH * 0.18)`
    - `chest`: `(centerX, minY + charH * 0.40)`
    - `hips`: `(centerX, minY + charH * 0.60)`
    - `left_knee`: `(centerX - charW * 0.20, minY + charH * 0.80)`
    - `left_foot`: `(centerX - charW * 0.20, maxY)`
    - `right_knee`: `(centerX + charW * 0.20, minY + charH * 0.80)`
    - `right_foot`: `(centerX + charW * 0.20, maxY)`
    - `weapon`: `(maxX - 2, minY + charH * 0.50)`
- Thuật toán `Soft Skinning Deformation`:
  - Với hành động `walk`:
    - Thân trên nhấp nhô `bodyOffsetY` (0 hoặc -1).
    - Vùng eo nằm giữa `chest` và `hips`: pixel tại đây được dịch chuyển với độ dịch nội suy tuyến tính `lerp(bodyOffsetY, 0, factor)` và lấp đầy các khoảng trống phát sinh để loại bỏ hoàn toàn vết rách ngang eo.
    - Chân trái & Chân phải xoay theo góc đùi `theta_hip = sin(t) * 15°` và góc gối `theta_knee = max(0, -sin(t)) * 25°`, bàn chân nhấc lên khi vung và tiếp đất cố định ở đáy.
  - Với hành động `attack` / `slash`:
    - Giữ nguyên vệt chém quang `Slash Arc` đẹp mắt và nối liền mượt mà phần thân với cánh tay.

- [ ] **Bước 1: Viết hàm `autoEstimateSkeletonRig` trong `template-animator.ts`**
- [ ] **Bước 2: Cải tiến thuật toán uốn biến dạng điểm ảnh mềm trong `generateTemplateAnimation`**
- [ ] **Bước 3: Biên dịch backend bằng `npm run build --prefix apps/server` đảm bảo không có lỗi**

---

### Nhiệm Vụ 3: Giao Diện Chấm Điểm Khớp Trực Quan (Joint Pinning Canvas HTML & CSS)

**Tập tin:**
- Chỉnh sửa: `apps/studio/index.html`
- Chỉnh sửa: `apps/studio/styles/main.css`

**Giao diện:**
- Tại `#wizard-panel-3` trong `index.html`:
  - Thêm một tab phụ chuyển đổi: `[Khung Xương Tương Tác (Joint Pins)]` và `[Danh Sách Hành Động (Actions)]`.
  - Khung gắn khớp `joint-pinning-container`:
    - Khung vẽ canvas `joint-pinning-canvas` kích thước 256x256 px hiển thị nhân vật mẫu phóng to.
    - Lớp phủ tương tác `joint-pinning-overlay` vẽ các đường nối xương (SVG hoặc 2D Canvas) và các chốt điểm tròn (Pins) phát sáng nhiều màu sắc theo vai trò khớp:
      - Head: Vàng cam `#f59e0b`
      - Chest/Hips: Xanh lam `#38bdf8`
      - Left Leg: Xanh lá `#4ade80`
      - Right Leg: Tím `#a855f7`
      - Weapon: Đỏ hồng `#f43f5e`
  - Các nút hành động phụ:
    - Nút "Tự Động Căn Khớp" (`#btn-rig-auto-align`): Reset các điểm pin về vị trí giải phẫu tự động.
    - Nút "Xem Thử Bước Đi" (`#btn-rig-test-cycle`): Kích hoạt chuyển động lặp khung xương tại chỗ để kiểm tra.
- CSS trong `main.css`:
  - Định dạng các điểm ghim tròn `.joint-pin-node` với viền phát sáng neon, hiệu ứng phóng to nhẹ khi hover (`transform: scale(1.2)`), con trỏ kéo (`cursor: grab / grabbing`).
  - Định dạng các đường xương nối bán trong suốt `.joint-bone-line`.

- [ ] **Bước 1: Cập nhật cấu trúc HTML cho công cụ Joint Pinning trong `apps/studio/index.html`**
- [ ] **Bước 2: Bổ sung các định dạng CSS cho bộ gắn khớp trong `apps/studio/styles/main.css`**

---

### Nhiệm Vụ 4: Tương Tác Kéo Thả Điểm Khớp & Tích Hợp Stepper Wizard (`main.ts`)

**Tập tin:**
- Chỉnh sửa: `apps/studio/src/main.ts`

**Logic tương tác & Tích hợp:**
- Quản lý trạng thái `activeSkeletonRig: SkeletonRig | null`.
- Hàm `renderJointPinningView()`:
  - Vẽ ảnh nhân vật mẫu lên `joint-pinning-canvas` với `imageSmoothingEnabled = false`.
  - Vẽ các đoạn xương nối giữa các điểm khớp.
  - Cập nhật vị trí các điểm pin trên lớp phủ tương tác.
- Lập trình sự kiện chuột:
  - Bắt sự kiện `mousedown`, `mousemove`, `mouseup` trên canvas/overlay để kéo thả điểm khớp được chọn.
  - Chuyển đổi tọa độ màn hình (256x256) sang tọa độ pixel gốc (64x64).
  - Cập nhật lại khung xương và tự động lưu vào Checkpoint.
- Nút "Tự Động Căn Khớp": Gọi hàm tự động tính toán lại vị trí các pin từ `baseCharState.pixels`.
- Nút "Xem Thử Bước Đi": Chạy vòng lặp test nhanh 4 frames động học ngay trên canvas gắn khớp.
- Cập nhật `handleGenerateAnimation()`:
  - Bổ sung `skeletonRig: activeSkeletonRig` vào payload gửi lên `POST /api/ai/generate-animation`.

- [ ] **Bước 1: Lập trình logic khởi tạo, vẽ và kéo thả điểm khớp trong `apps/studio/src/main.ts`**
- [ ] **Bước 2: Gắn sự kiện nút Tự Động Căn Khớp và Xem Thử Bước Đi**
- [ ] **Bước 3: Đồng bộ `skeletonRig` vào payload gọi API và Checkpoint lưu trữ**
- [ ] **Bước 4: Biên dịch frontend bằng `npm run build --prefix apps/studio` đảm bảo không có lỗi TypeScript**

---

### Nhiệm Vụ 5: Kiểm Tra Xác Thực Toàn Diện & Khởi Động Hệ Thống

**Tập tin:**
- Kiểm tra toàn bộ hệ thống (Server Bridge + Studio Web App).

- [ ] **Bước 1: Khởi động lại server backend với mã nguồn mới (`npx tsx apps/server/src/server.ts`)**
- [ ] **Bước 2: Kiểm tra gọi API `/api/ai/generate-animation` với payload có `skeletonRig`**
- [ ] **Bước 3: Xác nhận các frame sinh ra không còn khe nứt hở eo và bước chân cử động tự nhiên**
- [ ] **Bước 4: Hướng dẫn người dùng trải nghiệm thực tế công cụ kéo thả điểm khớp trên giao diện Studio**

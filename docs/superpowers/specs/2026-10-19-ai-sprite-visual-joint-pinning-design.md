# Đặc Tả Thiết Kế: Gán Khung Xương Thủ Công (Visual Joint Pinning) & Động Học Chuyển Động Mềm

Ngày: 2026-10-19  
Trạng thái: Đang xem xét phê duyệt (Reviewing)

---

## 1. Tổng Quan & Vấn Đề Cần Giải Quyết

### 1.1 Vấn đề thực tế
Khi người dùng thử nghiệm hoạt cảnh bước đi tạo từ thuật toán tự động cũ, hệ thống bộc lộ 2 khuyết điểm nghiêm trọng:
1. **Lỗi đứt gãy và mất điểm ảnh (Hở eo):** Việc phân tách thân và chân bằng một đường thẳng ngang cố định (`legSplitY`) khiến khi thân người nhấc lên 1 pixel, một khe nứt rỗng xuất hiện ngang hông. Đường cắt dọc thẳng đứng cũng cắt đứt trang phục, giáp eo và vũ khí của nhân vật.
2. **Chuyển động cứng nhắc (Stiff Motion):** Chân nhân vật bị kéo trượt tịnh tiến theo phương ngang như ngăn bàn, thiếu hoàn toàn độ gập của khớp gối và chuyển động xoay tự nhiên của khớp đùi.

### 1.2 Mục tiêu thiết kế
1. Cung cấp **Bộ công cụ gán khớp xương trực quan (Visual Joint Pinning UI)**: Cho phép người dùng nhìn thấy các khớp xương trực tiếp trên nhân vật mẫu phóng to và tự do kéo thả điều chỉnh tọa độ các khớp (Đầu, Ngực, Hông, Gối trái, Gối phải, Bàn chân trái, Bàn chân phải, Vũ khí).
2. Xây dựng **Thuật toán uốn biến dạng mềm (Soft Skinning Kinematics)**: 
   - Mỗi pixel được gắn trọng số với các đoạn xương gần nhất.
   - Vùng chuyển tiếp (như eo, hông) tự động co giãn mềm mại khi thân nhấp nhô, loại bỏ 100% hiện tượng hở khe hay đứt gãy pixel.
   - Chân bước đi bằng phép xoay góc khớp đùi và gập khớp gối, mô phỏng chuyển động sinh học chân thực.
3. Tích hợp **Chế độ xem thử dáng đi trực tiếp (Live Rigging Preview)** ngay trong khi người dùng đang tinh chỉnh các khớp.

---

## 2. Mô Hình Dữ Liệu Khung Xương (Rigging Data Model)

### 2.1 Cấu trúc JointPin và SkeletonRig
```typescript
export type JointId = 
  | 'head'
  | 'chest'
  | 'hips'
  | 'left_knee'
  | 'left_foot'
  | 'right_knee'
  | 'right_foot'
  | 'weapon';

export interface JointPin {
  id: JointId;
  name: string;
  x: number;          // Tọa độ trên lưới pixel gốc (0 -> width-1)
  y: number;          // Tọa độ trên lưới pixel gốc (0 -> height-1)
  parent?: JointId;   // Khớp cha trong cây phân cấp động học
  color: string;      // Màu hiển thị của điểm pin trên canvas
}

export interface SkeletonRig {
  width: number;
  height: number;
  rootJoint: JointId; // Mặc định là 'hips'
  joints: Record<JointId, JointPin>;
  bones: [JointId, JointId][]; // Danh sách các đoạn xương nối giữa 2 khớp
}
```

### 2.2 Cây phân cấp xương (Bone Hierarchy)
- `hips` (Khớp gốc - Pivot trung tâm)
  ├── `chest` (Ngực) ── `head` (Đầu)
  ├── `left_knee` (Gối trái) ── `left_foot` (Bàn chân trái)
  ├── `right_knee` (Gối phải) ── `right_foot` (Bàn chân phải)
  └── `weapon` (Vũ khí / Cánh tay)

---

## 3. Kiến Trúc Giao Diện Người Dùng (Pinning Canvas UI)

### 3.1 Bố cục tại Bước 3 (Cấu hình hoạt cảnh & Khung xương)
Bên cạnh danh sách chọn hành động (Walk, Attack, Jump...), một bảng công cụ **"Gán Khung Xương Nhân Vật (Joint Rigging Panel)"** được tích hợp:
- **Canvas gắn khớp tương tác (Rigging Viewport):**
  - Hiển thị nhân vật mẫu ở kích thước phóng to 256x256 px với nền lưới caro trong suốt.
  - Các đoạn xương hiển thị dưới dạng các đường nối phát sáng bán trong suốt.
  - Các điểm khớp (Joint Pins) là các vòng tròn có kích thước vừa tay chuột (bán kính 6px), hiển thị tên khớp khi rê chuột qua.
- **Tương tác chuột:**
  - `Hover`: Vòng tròn khớp sáng lên và hiện con trỏ kéo (`cursor: grab`).
  - `Drag & Drop`: Nhấp giữ và kéo điểm khớp đến vị trí mong muốn trên cơ thể nhân vật.
  - Tọa độ pixel (X, Y) được cập nhật theo thời gian thực.
- **Thanh công cụ bổ trợ:**
  - Nút **"Tự Động Căn Khớp (Auto-Estimate)"**: Thuật toán quét hộp giới hạn (Bounding Box) của nhân vật mẫu và tự động đặt 7 điểm khớp vào các vị trí chuẩn giải phẫu (Đầu ở 20% trên, Ngực ở 40%, Hông ở 60%, Gối ở 80%, Bàn chân ở đáy).
  - Nút **"Xem Thử Bước Đi (Test Pose Cycle)"**: Khung xương trên canvas bắt đầu đung đưa thử để người dùng đánh giá chuyển động trước khi kết xuất.

---

## 4. Thuật Toán Uốn Biến Dạng Điểm Ảnh (Skinning Kinematics Engine)

### 4.1 Gán Trọng Số Mềm Cho Từng Pixel (Weight Binding)
Để không bị đứt gãy ở các lát cắt ngang:
1. Đối với mỗi pixel `p(x, y)` thuộc nhân vật mẫu:
   - Tính khoảng cách Euclid tới các đoạn xương `[A, B]`.
   - Gán trọng số ảnh hưởng `w_i = 1 / (dist_i + epsilon)^2`.
   - Chuẩn hóa tổng trọng số `sum(w_i) = 1`.
2. Vùng eo (chuyển tiếp giữa `chest` và `hips`):
   - Pixel ở vùng này chịu ảnh hưởng đồng thời bởi cả hai khớp. Khi `chest` nhấc lên theo trục Y, các pixel vùng eo dịch chuyển một đoạn tỉ lệ thuận với khoảng cách, giúp phần thân áo và giáp co giãn liên tục, **triệt tiêu hoàn toàn khe hở đứt đôi người**.

### 4.2 Động Học Bước Chân Tự Nhiên (Leg Kinematics)
Thay vì trượt ngang:
- Khớp đùi xoay một góc `theta_hip(t) = A * sin(t)`.
- Khớp gối gập một góc `theta_knee(t) = max(0, -B * sin(t))`.
- Khi gập gối, bàn chân nhấc nhẹ lên khỏi mặt sàn trong pha lăng (swing phase) và hạ xuống tiếp đất vững chắc ở pha đứng (stance phase).
- Chân trái và chân phải lệch pha nhau đúng 180 độ (`PI`).

---

## 5. Luồng Dữ Liệu & Tích Hợp API

1. **Client (Studio):**
   - Khi người dùng bấm "Bắt Đầu Tạo Hoạt Ảnh", client gửi payload:
   ```json
   {
     "engine": "template",
     "action": "walk",
     "frameCount": 4,
     "size": 64,
     "basePixels": [...],
     "skeletonRig": {
       "joints": {
         "hips": { "x": 32, "y": 38 },
         "chest": { "x": 32, "y": 25 },
         "head": { "x": 32, "y": 14 },
         "left_knee": { "x": 28, "y": 50 },
         "left_foot": { "x": 28, "y": 60 },
         "right_knee": { "x": 36, "y": 50 },
         "right_foot": { "x": 36, "y": 60 }
       }
     }
   }
   ```
2. **Server (`template-animator.ts`):**
   - Đọc dữ liệu `skeletonRig`. Nếu client không gửi hoặc gửi thiếu, tự động kích hoạt bộ tính toán vị trí mặc định từ `basePixels`.
   - Áp dụng thuật toán biến dạng khung xương mềm để tạo danh sách N frames không gãy điểm ảnh.
   - Lưu các file PNG và phản hồi danh sách frames kèm metadata.
3. **Hiển thị & Nạp Timeline:**
   - Hoạt cảnh mượt mà được phát ngay lập tức trên Live Animation Player ở Bước 4.
   - Người dùng bấm "Nạp Vào Timeline Studio" để đưa các frame vào timeline chính.

---

## 6. Kế Hoạch Triển Khai (Dự Kiến)
- **Giai đoạn 1:** Xây dựng module tính toán biến dạng khung xương mềm `SkeletonKinematics` trong backend [template-animator.ts](file:///d:/pixel_draw/apps/server/src/template-animator.ts) để khắc phục ngay lập tức lỗi hở bụng và chuyển động cứng.
- **Giai đoạn 2:** Bổ sung giao diện kéo thả điểm ghim khớp `JointPinningCanvas` tại Bước 3 trong [index.html](file:///d:/pixel_draw/apps/studio/index.html) và [main.css](file:///d:/pixel_draw/apps/studio/styles/main.css).
- **Giai đoạn 3:** Liên kết sự kiện tương tác kéo thả điểm khớp, tính năng tự động căn chỉnh (Auto-Estimate) và tích hợp vào luồng Stepper Wizard trong [main.ts](file:///d:/pixel_draw/apps/studio/src/main.ts).
- **Giai đoạn 4:** Kiểm tra xác thực thực tế với nhân vật hiệp sĩ mẫu và bàn giao cho người dùng thử nghiệm.

# Đặc Tả Thiết Kế: Hệ Thống Đóng Gói Và Quản Lý Nhân Vật Cốt Lõi (Character Core Package)

- Ngày tạo: 2026-10-20
- Tác giả: Antigravity & Pair Programming Partner
- Trạng thái: Chờ người dùng phê duyệt (Pending User Review)
- Dự án: Pixel Draw Studio & Local Hub Monorepo
- Vị trí tệp: `docs/superpowers/specs/2026-10-20-character-core-package-design.md`

---

## 1. Tổng Quan Và Mục Tiêu Thiết Kế

### 1.1. Bối Cảnh Và Bài Toán Nghiệp Vụ
Trong quy trình sáng tạo pixel art và hoạt cảnh nhân vật game:
- Bước đầu tiên sinh ảnh bằng AI (hoặc vẽ tay) luôn tạo ra **Nhân vật gốc (Core Character / Base Pose)**. Đây là tài nguyên quan trọng nhất, đóng vai trò "ADN chuẩn" về phong cách, trang phục, bảng màu và tỷ lệ cơ thể.
- Mọi hoạt động tiếp theo (sinh các động tác `walk`, `run`, `idle`, `attack`, `jump`...) đều phụ thuộc 100% vào nhân vật gốc này.

**Vấn đề hiện tại:**
1. Sau khi sinh hoạt ảnh hoặc tải lại trang, nhân vật gốc này không được lưu vào một cấu trúc quản lý chuyên biệt mà nằm rải rác trong `storage/outputs/` hoặc trong dự án tạm thời.
2. Người dùng không thể dễ dàng quay lại nhân vật đã tạo từ tuần trước để phát triển thêm các động tác mới.
3. Khi sinh các chuỗi frame hoạt cảnh mới, các tệp frame không được tự động gom vào đúng thư mục của nhân vật đó trong Cây tài nguyên dự án (Project Asset Tree).

### 1.2. Mục Tiêu Cần Đạt
1. **Mô hình Đóng gói Thư mục Nhân vật (Character Package):** Mỗi nhân vật được coi như một gói tài nguyên hoàn chỉnh (Asset Package) nằm trong `characters/<character_slug>/`.
2. **Lưu trữ toàn diện dữ liệu gốc (character_core.json):** Lưu giữ ảnh gốc `base_pose.png`, mã Seed, Prompt, Bảng màu, Kích thước và Tọa độ 16 điểm khớp khung xương (Joint Pinning Skeleton).
3. **Tái sử dụng tức thì:**
   - Từ Cây thư mục dự án (Project Dock): Chuột phải vào nhân vật -> Chọn "Tạo động tác mới từ nhân vật này" -> Mở AI Studio nhảy thẳng vào Bước 3 với nhân vật và khung xương đã nạp sẵn.
   - Từ AI Studio (Bước 1): Nút "Chọn Nhân Vật Có Sẵn Từ Dự Án" cho phép duyệt danh mục các nhân vật đã lưu.
4. **Tự động phân loại hoạt cảnh:** Khi render động tác nào (`walk`, `attack`...), hệ thống tự động lưu các frame vào đúng thư mục con `characters/<character_slug>/<action>/`.
5. **Khả năng can thiệp thủ công:** Cho phép nạp `base_pose.png` lên Canvas để vẽ sửa chi tiết (thêm kiếm, đổi màu mắt...) rồi bấm "Cập nhật Nhân vật gốc" để các hoạt cảnh sau sinh chuẩn theo nét vẽ mới.

---

## 2. Kiến Trúc Thư Mục & Định Dạng Dữ Liệu

### 2.1. Cấu Trúc Thư Mục Lưu Trữ
Hệ thống lưu trữ trên ổ đĩa và hiển thị trên Cây tài nguyên (`storage/project_assets/`):

```text
storage/project_assets/
└── characters/
    └── hero_knight/
        ├── character_core.json                 (Metadata gốc: Seed, Prompt, Skeleton, Actions)
        ├── base_pose.png                       (Ảnh hiển thị trên Project Browser)
        ├── walk/
        │   ├── frame_1.png
        │   ├── frame_2.png
        │   ├── frame_3.png
        │   ├── frame_4.png
        │   └── walk_anim_meta.json
        ├── attack/
        │   ├── frame_1.png
        │   └── ...
        └── idle/
            └── ...
```

### 2.2. Định Dạng `character_core.json`
Được định nghĩa trong `packages/shared-types/src/index.ts`:

```typescript
export interface CharacterCoreData {
  id: string; // Định danh duy nhất, ví dụ: 'char_hero_knight_1792482659'
  name: string; // Tên hiển thị: 'Hero Knight'
  slug: string; // Tên thư mục an toàn: 'hero_knight'
  prompt: string; // Prompt gốc dùng để sinh nhân vật
  seed: number; // Seed đã khóa của nhân vật
  width: number; // Kích thước chiều rộng (ví dụ: 64)
  height: number; // Kích thước chiều cao (ví dụ: 64)
  pixels: PixelPoint[]; // Mảng điểm ảnh gốc
  thumbnailUrl?: string; // Data URL ảnh thu nhỏ
  colorPalette: string[]; // Bảng mã màu hex của nhân vật
  skeletonRig: JointPoint[]; // 16 điểm khớp khung xương đã gán
  actions: {
    action: string; // 'walk' | 'idle' | 'attack' ...
    label: string; // 'Đi bộ' | 'Đứng yên' ...
    framesCount: number;
    folderPath: string; // 'characters/hero_knight/walk'
    updatedAt: number;
  }[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 3. Thiết Kế API Backend Server (`apps/server`)

Bổ sung các REST endpoint trong `apps/server/src/server.ts` và `apps/server/src/asset-manager.ts`:

1. `POST /api/characters/save-core`
   - Nhận payload `CharacterCoreData` kèm base64 của ảnh gốc.
   - Tạo thư mục `storage/project_assets/characters/<slug>/`.
   - Ghi tệp `character_core.json` và lưu ảnh `base_pose.png`.
   - Đăng ký vào Cây tài nguyên `tree_metadata.json` để hiển thị trên Project Dock.
   - Trả về đối tượng nhân vật và đường dẫn thư mục.

2. `GET /api/characters/list`
   - Quét toàn bộ các thư mục con trong `storage/project_assets/characters/`.
   - Đọc các tệp `character_core.json` và trả về danh sách tóm tắt (id, name, slug, seed, thumbnailUrl, số lượng actions đã có, ngày tạo).

3. `GET /api/characters/:id`
   - Đọc đầy đủ thông tin chi tiết của một nhân vật gốc để nạp vào AI Studio hoặc Canvas.

4. `POST /api/characters/:id/save-action`
   - Lưu chuỗi frames vừa render của một hành động vào thư mục con `characters/<slug>/<action>/`.
   - Cập nhật trường `actions` trong tệp `character_core.json`.
   - Đồng bộ cây thư mục dự án.

5. `POST /api/characters/:id/update-core-pixels`
   - Cập nhật lại mảng `pixels` và ảnh `base_pose.png` sau khi người dùng vẽ sửa thủ công trên Canvas.

---

## 4. Thiết Kế Giao Diện Người Dùng & Luồng Thao Tác (`apps/studio`)

### 4.1. Bước 2: Tự Động Đóng Gói Khi Chốt Mẫu
1. Tại Bước 2 của AI Studio, khi người dùng nhấp **"Chốt Mẫu Này & Sang Bước 3"**:
   - Nếu nhân vật là mới tạo (chưa có gói thư mục): Mở modal xác nhận tên nhân vật (mặc định lấy gợi ý từ Prompt, ví dụ: *"Hero Knight"*).
   - Gọi API `POST /api/characters/save-core` để tạo gói thư mục nhân vật.
   - Tự động làm mới Cây thư mục dự án bên dưới Dock.
   - Chuyển tiếp người dùng sang Bước 3 một cách mượt mà.

### 4.2. Bước 3 & 4: Tự Động Phân Loại Hoạt Cảnh Vào Thư Mục
1. Khi người dùng render động tác (ví dụ: `Walk`) tại Bước 3 và Bước 4:
   - Các frame sinh ra tự động được gửi về API `POST /api/characters/:id/save-action`.
   - Lưu thành các sprite card trong thư mục `characters/<slug>/walk/`.
   - Đồng thời nạp vào Timeline của Studio.

### 4.3. Tái Sử Dụng Nhân Vật Gốc Từ Project Browser (Cây Thư Mục Chân Trang)
1. Trong cửa sổ Dự án & Thư mục (Project Asset Browser):
   - Khi người dùng nhấp chuột phải vào thư mục nhân vật hoặc tệp `character_core.json`:
     - Menu ngữ cảnh hiển thị thêm lựa chọn nổi bật: **"Tạo động tác mới từ nhân vật này (AI Studio)"**.
     - Nhấp chọn: AI Studio mở lên, **chuyển thẳng tới Bước 3** với ảnh nhân vật gốc, Seed đã khóa, bảng màu và khung xương đã định sẵn.
   - Thêm lựa chọn: **"Nạp lên Canvas để vẽ/chỉnh sửa"**:
     - Đưa ảnh `base_pose.png` lên Canvas để người dùng dùng cọ vẽ chỉnh sửa.
     - Thanh công cụ trên Canvas hiển thị nút: **"Cập nhật lại Nhân vật gốc"** để lưu đè nét vẽ mới vào gói nhân vật.

### 4.4. Tái Sử Dụng Nhân Vật Gốc Từ AI Studio (Bước 1)
1. Tại Bước 1 của AI Studio:
   - Thêm nút **"Chọn Nhân Vật Có Sẵn Từ Dự Án"** cạnh nút "Tải Mẫu Từ Máy Tính".
   - Nhấp vào sẽ mở một bảng danh sách các nhân vật đã tạo với hình thumbnail, tên nhân vật, danh sách động tác hiện có.
   - Chọn một nhân vật -> Hệ thống lập tức đưa vào Bước 3 để sẵn sàng render các hành động tiếp theo.

---

## 5. Tiêu Chuẩn Nghiệm Thu & Kiểm Thử (Verification Criteria)

1. **Tính toàn vẹn dữ liệu:** Tệp `character_core.json` lưu đúng và đủ toàn bộ dữ liệu: Seed, Prompt, Kích thước, 16 điểm khớp khung xương và danh sách hành động.
2. **Khả năng tải lại:** Đóng trình duyệt, mở lại Studio, chọn nhân vật từ thư mục `characters/` -> Nạp thành công vào Bước 3 của AI Studio mà không bị mất bất kỳ thông số nào.
3. **Phân loại thư mục chuẩn:** Mỗi động tác (`walk`, `attack`, `idle`) khi sinh ra đều nằm gọn gàng trong thư mục con tương ứng, không bị lẫn lộn vào thư mục gốc.
4. **Kiểm thử hồi quy:**
   - Lệnh `npm run build` vượt qua 100% không có lỗi TypeScript hay Vite build.
   - Toàn bộ 11 bộ test suites với 42 unit tests trong `npx vitest run` đều PASS.

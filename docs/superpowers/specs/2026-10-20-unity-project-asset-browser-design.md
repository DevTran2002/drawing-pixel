# Dac Ta Thiet Ke: Bang Quan Ly Tai Nguyen Du An Phong Cach Unity (Project & Asset Browser Dock)

- Ngay tao: 2026-10-20
- Tac gia: Antigravity & Pair Programming Partner
- Trang thai: Cho nguoi dung phe duyet (Pending User Review)
- Du an: Pixel Draw Studio & Local Hub Monorepo

---

## 1. Tong Quan Muc Tieu

### 1.1. Boi Canh Va Yeu Cau Nguoi Dung
Hien tai nguoi dung mong muon to chuc cac bo anh, sprite nhan vat va hoat canh theo mo hinh quan ly tap trung truc quan giong nhu cua so **Project Window trong Unity Editor**:
- Co cau truc cay thu muc phan cap (Folder Tree View) ben trai.
- Co luoi hien thi thu muc con va hinh anh thumbnail lon ben phai.
- Cho phep tao thu muc tuy y (`Assets/Characters/Hero/Idle`, `Run`, `Weapons`, `Enemies`...).
- Cho phep luu anh vua ve tren Canvas hoac sinh tu AI vao bat ky thu muc nao duoc chon.
- Cho phep nap nhanh anh tu thu muc len Canvas de ve tiep, hoac nap toan bo cac frame trong thu muc vao Timeline de phat chuyen dong.

### 1.2. Kien Truc Tong The
Chuyen doi khu vuc Footer thanh thanh Dock 2 che do:
1. **Tab `Dòng thời gian (Timeline)`**: Giao dien bien tap chuoi frame, nhip FPS, Onion Skin va Preview Player.
2. **Tab `Dự án & Thư mục (Project / Assets)`**: Giao dien quan ly cay thu muc va tai nguyen 2 cot chuan Unity Editor.

---

## 2. Thiet Ke Giao Dien Project Asset Browser (UI/UX)

### 2.1. Thanh Chuyen Che Do (Dock Mode Header)
Phia tren cung cua Footer, bo tri 2 tab chuyen doi:
```
[ Tab Dự án (Project) ]  [ Tab Dòng thời gian (Timeline) ]
```
Khi nhan `Project`, khu vuc Footer mo rong chieu cao len khoang 260px - 320px de tao khong gian duyet file thoang dang nhu Unity.

### 2.2. Phan Vung 1: Cot Cay Thu Muc (Left Folder Treeview - 220px)
- **Goc cay thu muc**: `Assets/`.
- **Cac thu muc mac dinh**:
  - `Assets/`
    - `Characters/`
      - `Hero/`
        - `Base/` (chua sprite tu the goc)
        - `Idle/` (chua cac frame dung im)
        - `Run/` (chua cac frame chay bo)
    - `Enemies/`
    - `Items/`
    - `Effects/`
- **Thao tac**:
  - Nut mui ten mo/dong nhanh thu muc con.
  - Nhap chuot vao thu muc de chon thu muc hien hanh.
  - Nhap chuot phai vao thu muc: Mo menu context (`Them thu muc con`, `Doi ten`, `Xoa`).

### 2.3. Phan Vung 2: Khung Noi Dung Thu Muc (Right Asset Viewport)
Bao gom 3 phan nho:
1. **Thanh Dieu Huong & Tac Vu (Top Toolbar)**:
   - **Breadcrumb Navigation**: Hien thi duong dan hien tai dang click, vi du: `Assets > Characters > Hero > Idle`. Nguoi dung co the nhap vao bat ky phan nao trong breadcrumb de quay nguoc len cap cha.
   - **Thanh tim kiem (Search input)**: Loc nhanh cac sprite va folder trong duong dan hien tai.
   - **Cac nut hanh dong chinh**:
     - `+ Thư mục` (+ Folder): Tao folder moi tai vi tri hien tai.
     - `Lưu Canvas vào đây` (Save Canvas Here): Dong goi frame/canvas hien tai thanh mot asset sprite luu vao thu muc nay.
     - `Nạp vào Timeline` (Load to Timeline): Nap toan bo cac sprite trong thu muc nay vao Timeline de bien tap va phat hoat canh.
2. **Luoi Hien Thi Tai Nguyen (Asset Grid Area)**:
   - **Folder Card**: Hien thi bieu tuong thu muc lon kem ten. Click dup (double-click) de di vao trong thu muc.
   - **Sprite Asset Card**: Hien thi thumbnail pixel-art sac net (crisp pixelated), ten file, kich thuoc pixel (vi du: `24x24`), so layer.
   - **Menu ngu canh khi chuot phai vao Sprite**:
     - `Mo tren Canvas de ve` (Open in Canvas).
     - `Them vao Timeline` (Add to Timeline).
     - `Doi ten` (Rename).
     - `Nhan ban` (Duplicate).
     - `Xoa` (Delete).
3. **Thanh Trang Thai Duoi Cung (Footer Status Bar)**:
   - Thong tin so luong item: vi du `4 items`.
   - **Thanh truot Zoom (Thumbnail Size Slider)**: Cho phep nguoi dung keo de thay doi kich co thumbnail tu nho (48px) den lon (128px), y het tinh nang Zoom Slider o goc duoi ben phai Project window cua Unity.

---

## 3. Kien Truc Luu Tru & Backend API

### 3.1. Mo Hinh Du Lieu Asset (`packages/shared-types`)
```typescript
export interface ProjectAssetItem {
  id: string;
  name: string;
  type: 'folder' | 'sprite';
  path: string; // Duong dan tuyet doi trong project, vi du: 'Assets/Characters/Hero/Idle'
  parentPath: string; // 'Assets/Characters/Hero'
  width?: number;
  height?: number;
  pixels?: Record<string, string>; // Du lieu pixel day du
  layers?: LayerData[]; // Du lieu layer neu luu da lop
  thumbnailUrl?: string; // Anh PNG thu nho base64 hoac url
  createdAt: number;
  updatedAt: number;
}

export interface ProjectAssetTree {
  rootPath: string;
  items: ProjectAssetItem[];
}
```

### 3.2. He Thong Luu Tru Server & Local Storage
- Luu tru metadata cay thu muc tai `storage/project_assets/tree_metadata.json` tren server.
- Luu tru anh PNG preview trong thu muc `storage/project_assets/thumbnails/`.
- Cung cap cac endpoint REST API tren server:
  - `GET /api/project-assets/tree`: Lay toan bo danh sach thu muc va asset.
  - `POST /api/project-assets/folder`: Tao thu muc moi `{ parentPath, name }`.
  - `DELETE /api/project-assets/item`: Xoa thu muc hoac file asset.
  - `POST /api/project-assets/save-sprite`: Luu sprite tu Canvas `{ folderPath, name, width, height, pixels, layers }`.
  - `POST /api/project-assets/rename`: Doi ten thu muc hoac sprite.
- Client co fallback luu tru vao `localStorage` de hoat dong lap tuc ngay ca khi khong ket noi mang.

---

## 4. Quy Trinh Tuong Tac Lien Mach (Workflow)

1. **Tao nhan vat moi**:
   - Vao tab `Dự án (Project)` -> Thu muc `Assets/Characters/`.
   - Tao thu muc `Hero_Knight/`. Ben trong tu dong khoi tao san `Base/`, `Idle/`, `Run/`.
2. **Luu tu the goc**:
   - Ve nhan vat tren Canvas.
   - Mo tab `Dự án`, vao thu muc `Assets/Characters/Hero_Knight/Base/`.
   - Nhan nut `Lưu Canvas vào đây`, dat ten la `hero_base_pose`.
3. **Tao va quan ly dong tac**:
   - Chuyen qua tab `Dòng thời gian (Timeline)`, bam `Tao tu Tu the goc` de sinh 4 frame `idle`.
   - Chuyen sang tab `Dự án`, vao `Assets/Characters/Hero_Knight/Idle/`.
   - Nhan `Lưu Timeline vào thư mục này`: toan bo 4 frame duoc luu thanh 4 sprite file trong thu muc `Idle`.
4. **Nap lai dong tac cu bat ky luc nao**:
   - Khi lam viec voi nhan vat khac, muon quay lai nhan vat cu: vao `Hero_Knight/Idle/`, nhan `Nạp vào Timeline`.
   - Toan bo bo frame hien len Timeline va Preview Player phat ngay lap tuc.

---

## 5. Ke Hoach Kiem Thu

1. **Unit Test**: Kiem tra cac thao tac tao cay thu muc, them phan tu con, xoa thu muc de quy, loc theo duong dan `parentPath`.
2. **Kiem thu API**: Kiem tra luu file, sinh thumbnail PNG, lay cay thu muc tu server.
3. **Kiem thu Giao dien**: Chuyen doi tab Project va Timeline, click dup mo thu muc, zoom slider doi kich thuoc thumbnail, luu va nap sprite len canvas.
4. **Build Kiem tra**: Dam bao `npm run build` monorepo thanh cong 100%.

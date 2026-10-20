# Ke Hoach Trien Khai: Bang Quan Ly Tai Nguyen Du An Phong Cach Unity (Project & Asset Browser Dock)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xay dung bang quan ly tai nguyen du an (Project & Asset Browser Dock) phong cach Unity Editor o phan Footer, cho phep to chuc thu muc phan cap, luu tru va nap sprite/animation truc quan.

**Architecture:** Thanh Dock Footer ho tro 2 che do: Tab `Dòng thời gian (Timeline)` va Tab `Dự án & Thư mục (Project)`. Khi o che do `Project`, hien thi giao dien 2 cot chuan Unity: cot trai la Cay thu muc (Folder Treeview), cot phai la Luoi tai nguyen (Asset Grid) voi breadcrumb, nut tao folder, nut luu canvas, nut nap vao timeline, va thanh truot zoom thumbnail.

**Tech Stack:** TypeScript, HTML5 Canvas, REST API, Vite, Vitest, CSS Grid / Flexbox.

**Spec:** `docs/superpowers/specs/2026-10-20-unity-project-asset-browser-design.md`

## Global Constraints

- Do not use icons or emojis in code, comments, or UI texts.
- Alway answer in Vietnamese.
- Alway comment code in Vietnamese.
- Use English to name the value, functions, and interfaces.
- Do not create file test (su dung file test san co de kiem thu).
- Do not auto commit to git.
- Limit the use of `.sudo()`.

## Review Focus

1. Chuyen doi qua lai giua tab `Project` va `Timeline` mượt mà, khong lam mat trang thai dang ve tren Canvas hay dang phat frame tren Timeline.
2. Tao thu muc con phan cap (vi du: `Assets/Characters/Hero/Idle`), cay thu muc cap nhat ngay lap tuc.
3. Luu Canvas vao thu muc dang mo: sinh du lieu pixel va thumbnail PNG, hien thi thumbnail sac net tren grid.
4. Click dup hoac chuot phai vao sprite: cho phep nap len Canvas de ve sua tiep.
5. Nut "Nap vao Timeline": nap toan bo cac frame sprite trong thu muc vao Timeline thanh mot dong tac hoat hoa hoan chinh.
6. Thanh truot Zoom thu phong thumbnail linh hoat tu 48px den 128px y het Unity.

---

### Task 1: Mo Hinh Du Lieu Asset Tree trong `packages/shared-types`

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Produces:
  - `ProjectAssetItem`: kieu du lieu cho mot folder hoac sprite asset.
  - `ProjectAssetTree`: cay chua danh sach asset items.
  - `createDefaultAssetTree()`: tao cay mac dinh voi cac thu muc `Characters/Hero/Base`, `Idle`, `Run`, `Items`, `Enemies`.

- [x] **Step 1: Bo sung cac interface vao `packages/shared-types/src/index.ts`**
- [x] **Step 2: Trien khai ham `createDefaultAssetTree`**
- [x] **Step 3: Build shared-types kiem tra hop le**
Chay: `npm run build --workspace=@pixel-draw/shared-types`
Expected: Build thanh cong voi exit code 0.

---

### Task 2: Server API Quan Ly Asset Du An (`apps/server/src/asset-manager.ts` & `server.ts`)

**Files:**
- Create: `apps/server/src/asset-manager.ts`
- Modify: `apps/server/src/server.ts`

**Interfaces:**
- Produces:
  - `GET /api/project-assets/tree`: tra ve cay asset hien tai.
  - `POST /api/project-assets/folder`: tao thu muc moi.
  - `POST /api/project-assets/save-sprite`: luu sprite kem thumbnail PNG.
  - `DELETE /api/project-assets/item`: xoa thu muc hoac sprite.
  - `POST /api/project-assets/rename`: doi ten item.

- [x] **Step 1: Tao file `apps/server/src/asset-manager.ts` xu ly doc/ghi file metadata va luu PNG**
- [x] **Step 2: Tich hop cac route vao `apps/server/src/server.ts`**
- [x] **Step 3: Build server kiem tra hop le**
Chay: `npm run build --workspace=@pixel-draw/server`
Expected: Build thanh cong voi exit code 0.

---

### Task 3: Bo Dieu Khien Trinh Duyet Asset Client (`apps/studio/src/core/asset-browser-controller.ts`)

**Files:**
- Create: `apps/studio/src/core/asset-browser-controller.ts`

**Interfaces:**
- Produces:
  - Class `AssetBrowserController`: quan ly duong dan hien tai (`currentPath`), breadcrumbs, tim kiem, go/back, va dong bo API.

- [x] **Step 1: Trien khai `AssetBrowserController` voi day du cac ham duyet cay, breadcrumbs va tim kiem**
- [x] **Step 2: Kiem tra import va build client**

---

### Task 4: Thiet Ke Giao Dien Project Window Dock tren Footer (`index.html` & `main.css`)

**Files:**
- Modify: `apps/studio/index.html`
- Modify: `apps/studio/styles/main.css`

**Interfaces:**
- Produces:
  - Cụm tab chuyen che do tren footer: `[Dự án (Project)]` | `[Dòng thời gian (Timeline)]`.
  - Khung giao dien `#dock-project-view` chua:
    - Cot trai: `#project-treeview`
    - Cot phai: `#project-content-view` gom breadcrumbs, thanh tim kiem, cac nut hanh dong, luoi `#project-asset-grid`, va thanh zoom slider.
  - CSS layout 2 cot co the cuon doc lap, giao dien chuan Unity Dark Theme.

- [x] **Step 1: Cap nhat cau truc HTML footer trong `apps/studio/index.html`**
- [x] **Step 2: Bo sung CSS cho Project Dock trong `apps/studio/styles/main.css`**

---

### Task 5: Tich Hop Toan Bo Logic Va Su Kien trong `apps/studio/src/main.ts`

**Files:**
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Produces:
  - Chuyen doi giua tab `Project` va `Timeline`.
  - Render cay thu muc (Treeview) ben trai.
  - Render cac card folder va sprite ben phai.
  - Click dup mo folder, click breadcrumb dieu huong.
  - Nut "Lưu Canvas vào đây" luu sprite vao thu muc hien tai.
  - Nut "Nạp vào Canvas" va "Nạp vào Timeline".
  - Thanh truot Zoom thumbnail.

- [x] **Step 1: Khoi tao `AssetBrowserController` va gan su kien chuyen tab Footer**
- [x] **Step 2: Viet cac ham render Treeview va Asset Grid**
- [x] **Step 3: Gan su kien tao folder, luu canvas, nap canvas, nap timeline va zoom slider**
- [x] **Step 4: Kiem tra tuong tac tren browser**

---

### Task 6: Kiem Tra Toan Dien & Build Monorepo

- [x] **Step 1: Chay toan bo test suites**
Chay: `npx vitest run apps/studio/tests apps/server/tests packages/shared-types/tests`
Expected: 100% test suites PASS.

- [x] **Step 2: Build toan bo Monorepo**
Chay: `npm run build`
Expected: 100% build thanh cong voi exit code 0.


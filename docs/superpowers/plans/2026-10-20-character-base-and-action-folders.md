# Ke Hoach Trien Khai: Quan Ly Nhan Vat Goc (Base Pose) Va He Thong Thu Muc Dong Tac (Action Folders)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xay dung he thong quan ly nhan vat goc (Base Pose) lam trong tam, to chuc cac dong tac theo he thong thu muc (Action Folders / Tabs) tren Footer Timeline, va cung cap tinh nang tao/tai tao hoat anh tu dong tu nhan vat goc.

**Architecture:** Mo rong `AnimationClip` de luu tru mang `frames` doc lap cho tung thu muc dong tac (`base`, `idle`, `run`). Thanh Timeline Footer hien thi he thong Tab thu muc phia tren dai frame; khi chon tab nao thi timeline va preview player dong bo chay theo dong tac do. Tich hop nut bam "Tao tu Tu the goc" ket noi voi Template Rigging de sinh hoat anh tu diem anh nhan vat goc ma khong lam mat frame goc.

**Tech Stack:** TypeScript, Canvas API, Vite, Vitest, CSS Grid/Flexbox, REST API / WebSocket.

**Spec:** `docs/superpowers/specs/2026-10-20-character-base-and-action-folders-design.md`

## Global Constraints

- Do not use icons or emojis in code, comments, or UI texts.
- Alway answer in Vietnamese.
- Alway comment code in Vietnamese.
- Use English to name the value, functions, and interfaces.
- Do not create file test (su dung va cap nhat file test san co `animation-controller.test.ts`).
- Do not auto commit to git.
- Limit the use of `.sudo()`.

## Review Focus

1. Nguoi dung ve o tab `Base` sau do chuyen sang `Idle`, bam "Tao tu Base": cac frame sinh ra phai nam trong `Idle`, khong duoc ghi de lam mat `Base`.
2. Khi dang o `Idle` co 4 frames, nguoi dung quay ve `Base` sua chi tiet roi quay lai `Idle` bam "Tai tao tu Base": bo 4 frame cu duoc thay the bang bo 4 frame moi phan anh dung chi tiet vua sua.
3. Xuat file `.pxdraw` va nhap lai: toan bo cac thu muc dong tac va frame ben trong phai duoc bao toan 100%.
4. Tuong thich nguoc voi cac file `.pxdraw` cu (chi co mang frames phang): he thong phai tu dong chuyen doi sang cau truc thu muc hop le ma khong gay loi crash.
5. Preview Player tren sidebar phai lap dung cac frame cua thu muc dong tac dang chon, khong bi tron lan giua cac dong tac khac nhau.

---

### Task 1: Mo Rong Kieu Du Lieu trong `packages/shared-types`

**Files:**
- Modify: `packages/shared-types/src/index.ts:35-125`

**Interfaces:**
- Produces:
  - `AnimationClip.frames?: FrameData[]`
  - `AnimationClip.label?: string`
  - `AnimationClip.isBase?: boolean`
  - `CanvasProject.activeClipId?: string`
  - `createDefaultProject(width, height, name)` tra ve project co 3 clip: `base`, `idle`, `run`.

- [ ] **Step 1: Cap nhat interface `AnimationClip` va `CanvasProject`**
Mo rong cac truong `frames`, `label`, `isBase` trong `AnimationClip` va `activeClipId` trong `CanvasProject`.

- [ ] **Step 2: Cap nhat ham `createDefaultProject`**
Khoi tao san 3 thu muc:
1. `clip_base` (name: 'base', label: 'Tu the goc', isBase: true, frames: [initialFrame])
2. `clip_idle` (name: 'idle', label: 'Dung im', frames: [])
3. `clip_run` (name: 'run', label: 'Chay bo', frames: [])
Dat `activeClipId = 'clip_base'` va `project.frames = baseClip.frames`.

- [ ] **Step 3: Build shared-types de kiem tra tinh hop le**
Chay: `npm run build --workspace=@pixel-draw/shared-types`
Expected: Build thanh cong khong loi type.

---

### Task 2: Nang Cap `AnimationController` Ho Tro Thu Muc Dong Tac

**Files:**
- Modify: `apps/studio/src/animation/animation-controller.ts`
- Modify: `apps/studio/tests/animation-controller.test.ts` (cap nhat test san co)

**Interfaces:**
- Produces:
  - `animController.setActiveClipById(clipId: string): void`
  - `animController.getActiveClip(): AnimationClip`
  - `animController.getBaseClip(): AnimationClip`
  - `animController.addFolderClip(name: string, label: string): AnimationClip`
  - `animController.removeFolderClip(clipId: string): boolean`
  - `animController.setClipFrames(clipId: string, frames: FrameData[]): void`

- [ ] **Step 1: Cap nhat cac test case trong `apps/studio/tests/animation-controller.test.ts`**
Bo sung cac test kiem tra khoi tao thu muc mac dinh, chuyen doi thu muc bang `setActiveClipById`, them/xoa thu muc, va kiem tra tinh bat bien cua thu muc `base`.

- [ ] **Step 2: Chay test de xac nhan FAIL**
Chay: `npx vitest run apps/studio/tests/animation-controller.test.ts`
Expected: FAIL vi chua trien khai cac phuong thuc moi.

- [ ] **Step 3: Trien khai cac phuong thuc moi trong `AnimationController`**
Viet ma xu ly trong `apps/studio/src/animation/animation-controller.ts`, dong bo `project.frames` tham chieu toi `clip.frames` cua clip dang active.

- [ ] **Step 4: Chay test de xac nhan PASS**
Chay: `npx vitest run apps/studio/tests/animation-controller.test.ts`
Expected: PASS 100%.

---

### Task 3: Thiet Ke Giao Dien Action Folders tren Footer Timeline

**Files:**
- Modify: `apps/studio/index.html:318-362`
- Modify: `apps/studio/styles/main.css`

**Interfaces:**
- Produces:
  - Khung HTML `#timeline-action-tabs` nam phia tren dải frames.
  - Nut `#btn-generate-from-base` tren thanh dieu khien timeline.
  - Cac lop CSS `.timeline-tabs-bar`, `.action-tab`, `.action-tab.active`, `.btn-generate-from-base`.

- [ ] **Step 1: Them HTML thanh Tabs va Nut Tao tu Base trong `apps/studio/index.html`**
Bo sung container `#timeline-action-tabs` va nut `#btn-generate-from-base` vao khu vuc footer timeline.

- [ ] **Step 2: Them dinh dang CSS trong `apps/studio/styles/main.css`**
Dinh dang dep mat, chuan cyber-dark UI cho thanh tabs thu muc va nut hanh dong tao hoat anh tu Base.

---

### Task 4: Trien Khai Logic Quan Ly Thu Muc & Su Kien trong `apps/studio/src/main.ts`

**Files:**
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Produces:
  - Ham `renderActionTabs(): void`
  - Su kien chuyen tab thu muc
  - Su kien them thu muc moi
  - Su kien xoa thu muc (tru thu muc base)
  - Cap nhat su kien hoan thanh Stepper Wizard (`btnWizardFinish`) de giu nguyen `clip_base` va ghi frames vao clip dong tac tuong ung.

- [ ] **Step 1: Xay dung ham `renderActionTabs`**
Tao danh sach cac nut tab dai dien cho cac clip trong `project.clips`, hien thi ten tieng Viet, so frame dang co, va nut xoa (cho clip khong phai base).

- [ ] **Step 2: Gan su kien chuyen tab va render lai giao dien**
Khi nhan tab, goi `animController.setActiveClipById(clip.id)`, cap nhat canvas buffers, timeline frames va preview player.

- [ ] **Step 3: Cap nhat luong xu ly ket thuc tao hoat anh Stepper Wizard**
Chinh sua `btnWizardFinish`: luu nhan vat goc vao `clip_base` va luu cac frame tao ra vao thu muc dong tac duoc chon (`idle`, `run`...) thay vi ghi de xoa sach.

---

### Task 5: Trien Khai Tinh Nang "Tao / Tai Tao Tu Tu The Goc"

**Files:**
- Modify: `apps/studio/src/main.ts`

**Interfaces:**
- Produces:
  - Ham `generateAnimationFromBase(actionName: string): Promise<void>`
  - Su kien click `#btn-generate-from-base`

- [ ] **Step 1: Xay dung ham lay diem anh goc tu `clip_base`**
Trich xuat toan bo pixel dang co tu cac layer cua frame trong thu muc `clip_base`.

- [ ] **Step 2: Ket noi voi bo xu ly Template Rigging tao frame chuyen dong**
Goi API `/api/template-animate` tren server gui kem du lieu `basePixels`, `action: 'idle' | 'run'`, nhan ve danh sach cac frame diem anh moi.

- [ ] **Step 3: Cap nhat frames vao thu muc dang mo va tu dong phat chuyen dong**
Nap cac frame moi vao `currentClip.frames`, cap nhat timeline va kich hoat `previewPlayer.play()`.

---

### Task 6: Dong Goi Du An .pxdraw & Kiem Tra Toan Dien (End-to-End Verification)

**Files:**
- Modify: `apps/studio/src/main.ts` (phan import/export .pxdraw)

- [ ] **Step 1: Cap nhat ham luu va nap file .pxdraw**
Dam bao khi luu se luu toan bo mang `clips` chua cac `frames` ben trong. Khi mo file cu, tu dong migrate sang cau truc thu muc moi.

- [ ] **Step 2: Chay toan bo test suites**
Chay: `npx vitest run`
Expected: 100% test suites PASS.

- [ ] **Step 3: Build toan bo Monorepo**
Chay: `npm run build`
Expected: Build thanh cong toan bo monorepo, khong co loi type hoac lint.

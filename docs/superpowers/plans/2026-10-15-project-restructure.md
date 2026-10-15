# Ke hoach Trien khai Tai cau truc Thu muc Du an Pixel Draw

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quy hoach lai toan bo kho anh, tap du lieu va mo hinh AI trong du an pixel_draw vao cac thu muc chuan, don dep tep thua va dong bo duong dan trong ma nguon.

**Architecture:** Tao cac thu muc chuyen biet (`assets/`, `models/`, `notebooks/`, `storage/outputs/`), di chuyen du lieu dung vi tri, cap nhat cac file ma nguon lien quan (`ai-helper.ts`, `server.ts`, `th_generate_stardew_portrait.py`, `th_tag_stardew_portraits.py`, `.gitignore`) va xac minh tinh toan ven bang viec build monorepo cung nhu goi API server.

**Tech Stack:** Node.js, TypeScript, Python, Diffusers, Gitignore.

**Spec:** `docs/superpowers/specs/2026-10-15-project-restructure-design.md`

## Global Constraints

- Khong tu dong commit vao git (Do not auto commit to git).
- Khong tao tep tin test (Not create file test).
- Toan bo binh luan ma nguon phai bang tieng Viet.
- Tuyet doi khong su dung icon hoac emoji.
- Dat ten bien va gia tri bang tieng Anh.
- Dam bao quy trinh build monorepo `npm run build` chay thanh cong 100%.

## Review Focus

- Duong dan tuyet doi/tuong doi cua mo hinh LoRA trong Python va Node.js phai thong nhat.
- Thu muc `storage/outputs/` phai tu dong duoc tao neu chua co khi sinh anh.
- Cac tep anh do AI tao ra truoc do phai duoc di chuyen an toan khong lam mat du lieu.
- Khong lam gay WebSocket hoac API `/api/ai/load` va `/api/ai/generate` cua server.
- File .gitignore phai loai tru dung cac tep zip, checkpoints lon tranh nang kho chua git.

---

### Task 1: Tao cau truc thu muc moi va don dep thu muc rong, tep trung lap

**Files:**
- Create: `assets/datasets/`
- Create: `assets/extracted/`
- Create: `models/lora/`
- Create: `models/checkpoints/`
- Create: `notebooks/`
- Create: `storage/outputs/`
- Delete: `sprites/`
- Delete: `output_sprites/`
- Delete: `stardew_colab_training.ipynb`

- [x] **Step 1: Tao cac thu muc moi can thiet**
Chay lenh tao cac thu muc:
`assets/datasets`, `assets/extracted`, `models/lora`, `models/checkpoints`, `notebooks`, `storage/outputs`.

- [x] **Step 2: Xoa cac thu muc rong va tep trung lap**
Xoa thu muc `sprites/`, `output_sprites/` va tep `stardew_colab_training.ipynb`.

- [x] **Step 3: Xac minh danh sach thu muc da tao va cac thu muc cu da bi xoa**
Chay kiem tra thu muc bang powershell.

---

### Task 2: Di chuyen cac tep du lieu, mo hinh, anh va so tay huan luyen

**Files:**
- Move: `stardew_portraits.zip` -> `assets/datasets/`
- Move: `stardew_portraits_tagged.zip` -> `assets/datasets/`
- Move: `stardew_characters.zip` -> `assets/datasets/`
- Move: `trainning/*` -> `assets/extracted/`
- Delete: `trainning/`
- Move: `th_stardew_portrait_lora.safetensors` -> `models/lora/`
- Move: `model_trainning/th_stardew_generator.pt` -> `models/checkpoints/`
- Move: `model_trainning/th_stardew_portraits_model.pt` -> `models/checkpoints/`
- Delete: `model_trainning/`
- Move: `th_stardew_colab_training.ipynb` -> `notebooks/`
- Move: `th_stardew_character_*.png` -> `storage/outputs/`

- [x] **Step 1: Di chuyen cac tep zip dataset vao assets/datasets/**
Di chuyen `stardew_portraits.zip`, `stardew_portraits_tagged.zip`, `stardew_characters.zip`.

- [x] **Step 2: Di chuyen thu muc trainning vao assets/extracted/ va don dep thu muc goc trainning**
Di chuyen toan bo du lieu va xoa thu muc `trainning/`.

- [x] **Step 3: Di chuyen cac mo hinh LoRA va checkpoints vao models/**
Di chuyen `th_stardew_portrait_lora.safetensors` vao `models/lora/`, di chuyen 2 file `.pt` tu `model_trainning/` vao `models/checkpoints/`, xoa `model_trainning/`.

- [x] **Step 4: Di chuyen so tay huan luyen Colab vao notebooks/**
Di chuyen `th_stardew_colab_training.ipynb` vao `notebooks/`.

- [x] **Step 5: Di chuyen cac anh AI sinh ra vao storage/outputs/**
Di chuyen tat ca cac tep `th_stardew_character_*.png` vao `storage/outputs/`.

- [x] **Step 6: Xac minh thu muc goc sach se va cac tep nam dung vi tri moi**
Kiem tra danh sach tep o thu muc goc.

---

### Task 3: Cap nhat ma nguon Node.js va Python dong bo duong dan moi

**Files:**
- Modify: `apps/server/src/ai-helper.ts`
- Modify: `apps/server/src/server.ts`
- Modify: `scripts/th_generate_stardew_portrait.py`
- Modify: `scripts/th_tag_stardew_portraits.py`
- Modify: `.gitignore`

- [x] **Step 1: Cap nhat apps/server/src/ai-helper.ts**
Sua ham `getProjectRoot()` de nhan dien goc du an qua `package.json`.
Sua `loadPngToPixels()` de uu tien tim tep anh trong `storage/outputs/`.
Sua `generateStardewPortrait()` de truyen tham so `--lora` va `--output_prefix` dung vi tri trong `models/lora/` va `storage/outputs/`.

- [x] **Step 2: Cap nhat apps/server/src/server.ts**
Sua duong dan fallback cho endpoint `/api/ai/load` tro ve `storage/outputs/th_stardew_character_pixel_64x64.png`.

- [x] **Step 3: Cap nhat scripts/th_generate_stardew_portrait.py**
Sua default `--lora` thanh `models/lora/th_stardew_portrait_lora.safetensors`.
Sua default output de luu vao `storage/outputs/th_stardew_character`.
Bo sung lenh tu dong tao thu muc `os.makedirs(os.path.dirname(output_prefix), exist_ok=True)`.

- [x] **Step 4: Cap nhat scripts/th_tag_stardew_portraits.py**
Sua default `output_zip` thanh `assets/datasets/stardew_portraits_tagged.zip`.

- [x] **Step 5: Cap nhat .gitignore**
Them cac duong dan loai tru cho `assets/datasets/*.zip`, `assets/extracted/`, `models/**/*.pt`, `models/**/*.safetensors`, `storage/outputs/*` (ngoai tru `.gitkeep`).

---

### Task 4: Kiem tra bien dich va xac minh toan dien

**Files:**
- Check: `apps/server`
- Check: `apps/studio`
- Check: `packages/shared-types`

- [x] **Step 1: Chay kiem tra bien dich monorepo**
Chay lenh `npm run build` de xac nhan tat ca cac goi khong co loi TypeScript.

- [x] **Step 2: Kiem tra nap anh pixel qua server API**
Gui request POST `/api/ai/load` den server (cong 3055) voi payload rong hoac truyen ten tep de xac nhan server nap anh tu `storage/outputs/` thanh cong.

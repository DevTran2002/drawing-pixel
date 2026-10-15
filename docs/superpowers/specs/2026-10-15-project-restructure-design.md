# Dac ta Thiet ke Tai cau truc Thu muc Du an Pixel Draw

- Ngay: 2026-10-15
- Trang thai: Da duoc nguoi dung chap thuan thiet ke

## 1. Muc tieu
He thong hoa lai toan bo cau truc luu tru du lieu, kho anh, tap du lieu huan luyen va cac mo hinh AI trong du an `pixel_draw`. Loai bo cac tep tin va thu muc thua, quy hoach thanh cac khu vuc chuyen biet ro rang ma khong lam gian doan hoat dong cua Server, MCP va Studio Frontend.

## 2. Hien trang va van de can giai quyet
- Cac tep anh va tep nen du lieu dataset (`stardew_portraits.zip`, `stardew_portraits_tagged.zip`, `stardew_characters.zip`) nam ngon ngang o thu muc goc.
- Cac anh sinh ra boi mo hinh LoRA (`th_stardew_character_*.png`) xuat truc tiep ra thu muc goc, khong co thu muc quan ly tap trung.
- Mo hinh LoRA `th_stardew_portrait_lora.safetensors` nam o thu muc goc, trong khi cac mo hinh PyTorch truoc do lai nam o `model_trainning/`.
- Ton tai 2 tep so tay Colab trung lap: `stardew_colab_training.ipynb` va `th_stardew_colab_training.ipynb`.
- Cac thu muc rong khong su dung: `sprites/`, `output_sprites/`.
- Thu muc `trainning/` chua du lieu asset trich xuat tu truoc (hon 2000 tep, khoang 209 MB) chua duoc sap xep vao kho asset chuan.

## 3. So do cau truc thu muc moi

```text
pixel_draw/
|-- apps/
|   |-- mcp/
|   |-- server/
|   `-- studio/
|-- packages/
|   `-- shared-types/
|-- scripts/
|   |-- th_generate_stardew_portrait.py
|   `-- th_tag_stardew_portraits.py
|-- notebooks/
|   `-- th_stardew_colab_training.ipynb
|-- models/
|   |-- lora/
|   |   `-- th_stardew_portrait_lora.safetensors
|   `-- checkpoints/
|       |-- th_stardew_generator.pt
|       `-- th_stardew_portraits_model.pt
|-- assets/
|   |-- datasets/
|   |   |-- stardew_portraits.zip
|   |   |-- stardew_portraits_tagged.zip
|   |   `-- stardew_characters.zip
|   `-- extracted/
|       |-- th_collected_assets/
|       `-- th_temp_unpacked_content/
|-- storage/
|   `-- outputs/
|       |-- th_stardew_character_raw_512.png
|       |-- th_stardew_character_transparent_512.png
|       |-- th_stardew_character_pixel_64x64.png
|       `-- th_stardew_character_pixel_64x64_clean.png
|-- docs/
|   `-- superpowers/
`-- tests/
```

## 4. Ke hoach di chuyen va don dep chi tiet

### 4.1. Tao thu muc moi
- `assets/datasets/`
- `assets/extracted/`
- `models/lora/`
- `models/checkpoints/`
- `notebooks/`
- `storage/outputs/`

### 4.2. Di chuyen tep du lieu
1. Dataset:
   - `stardew_portraits.zip` -> `assets/datasets/`
   - `stardew_portraits_tagged.zip` -> `assets/datasets/`
   - `stardew_characters.zip` -> `assets/datasets/`
2. Asset trich xuat:
   - Toan bo noi dung trong `trainning/` -> `assets/extracted/`
   - Xoa thu muc cu `trainning/`
3. Mo hinh:
   - `th_stardew_portrait_lora.safetensors` -> `models/lora/`
   - `model_trainning/th_stardew_generator.pt` -> `models/checkpoints/`
   - `model_trainning/th_stardew_portraits_model.pt` -> `models/checkpoints/`
   - Xoa thu muc cu `model_trainning/`
4. So tay Colab:
   - `th_stardew_colab_training.ipynb` -> `notebooks/`
   - Xoa tep trung lap `stardew_colab_training.ipynb`
5. Anh dau ra sinh boi AI:
   - `th_stardew_character_*.png` -> `storage/outputs/`
6. Thu muc rong can xoa:
   - `sprites/`
   - `output_sprites/`

## 5. Cap nhat ma nguon de dong bo duong dan

### 5.1. apps/server/src/ai-helper.ts
- Ham `getProjectRoot()`: cap nhat dieu kien nhan dien thu muc goc bang su hien dien cua `package.json` hoac `apps/server` (tranh phu thuoc vao viec tim file LoRA o root).
- Ham `generateStardewPortrait()`:
  - Duong dan LoRA mac dinh chuyen ve `path.join(projectRoot, 'models', 'lora', 'th_stardew_portrait_lora.safetensors')`.
  - Duong dan anh xuat ra chuyen ve `path.join(projectRoot, 'storage', 'outputs', 'th_stardew_character_pixel_64x64.png')`.
- Ham `loadPngToPixels()`:
  - Neu tham so `imagePath` la ten file don thuan hoac duong dan tuong doi, mac dinh tim kiem trong `storage/outputs/` truoc, neu khong co moi tim o project root.

### 5.2. apps/server/src/server.ts
- Tai endpoint `/api/ai/load`:
  - Gia tri fallback cho `imagePath` dat la `path.join('storage', 'outputs', 'th_stardew_character_pixel_64x64.png')`.

### 5.3. scripts/th_generate_stardew_portrait.py
- Tham so CLI `--lora`: gia tri mac dinh la `models/lora/th_stardew_portrait_lora.safetensors`.
- Tham so `output_prefix`: mac dinh la `storage/outputs/th_stardew_character`.
- Bo sung logic tu dong khoi tao thu muc thuoc `output_prefix` neu chua ton tai bang `os.makedirs(os.path.dirname(output_prefix), exist_ok=True)`.

### 5.4. scripts/th_tag_stardew_portraits.py
- Gia tri mac dinh cua `output_zip` trong ham `th_create_tagged_zip`: `assets/datasets/stardew_portraits_tagged.zip`.

### 5.5. Cua so bo qua Git (.gitignore)
Bo sung cac mau loai tru de tranh dua cac tep dung luong lon vao git:
- `assets/datasets/*.zip`
- `assets/extracted/`
- `models/**/*.pt`
- `models/**/*.safetensors`
- `storage/outputs/*`
- `!storage/outputs/.gitkeep`

## 6. Kiem tra tinh toan ven (Verification)
- Kiem tra toan bo thu muc root de xac nhan khong con tep zip, anh roi hay thu muc rong.
- Chay `npm run build` tren toan bo monorepo de xac nhan khong co loi bien dich TypeScript.
- Goi thu nghiem endpoint `POST /api/ai/load` cua server de xac minh viec nap anh tu `storage/outputs/` van hoat dong chinh xac.

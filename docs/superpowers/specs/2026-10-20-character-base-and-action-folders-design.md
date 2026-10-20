# Dac Ta Thiet Ke: Quan Ly Nhan Vat Goc (Base Pose) Va He Thong Thu Muc Dong Tac (Action Folders) Tren Timeline

- Ngay tao: 2026-10-20
- Tac gia: Antigravity & Pair Programming Partner
- Trang thai: Cho nguoi dung phe duyet (Pending User Review)
- Du an: Pixel Draw Studio & Local Hub Monorepo

---

## 1. Tong Quan Va Muc Tieu Thiet Ke

### 1.1. Boi Canh Va Van De Hien Tai
Trong phien ban Pixel Draw Studio hien tai, quy trinh tao hoat anh nhan vat da dat duoc buoc tien lon voi bo khung xuong Template Rigging (dac biet la 2 dong tac chuan nhip dieu: Dung im `idle` va Chay bo `run`). Tuy nhien, he thong gap phai 3 han che nghiem trong ve luong lam viec (workflow) cua nguoi dung:

1. **Mat nhan vat goc sau khi tao hoat anh**: Khi hoan thanh trinh tao dong tac (AI Stepper Wizard hoac Template Rigging), he thong thuc hien `project.frames = []` va ghi de toan bo frame cu bang cac frame chuyen dong moi sinh ra. Dieu nay xoa so hoan toan frame nhan vat goc ban dau (Base Pose).
2. **Khong the quay lai chinh sua va tai tao hoat anh**: Do mat frame goc, nguoi dung khong the chinh sua thu cong nhan vat (vi du: doi mau ao, them vu khi, ve them toc) roi yeu cau he thong tai tao lai cac bo hoat anh tu nhan vat da sua.
3. **Thanh Footer Timeline don dieu, thieu phan loai**: Footer hien tai chi hien thi mot danh sach phang cac frame noi duoi nhau, gay roi mat khi du an co nhieu dong tac va khong the hinh dung cac bo frame theo tung nhom hanh dong rieng biet.

### 1.2. Muc Tieu Dat Duoc
- **Dat Nhan Vat Goc (Base Pose) lam trong tam**: Nhan vat goc duoc quan ly doc lap, an toan, khong bao gio bi xoa hoac ghi de boi bat ky quy trinh tao hoat anh tu dong nao.
- **He thong Thu muc Dong tac (Action Folders / Tabs) tai Footer**: Chia thanh Timeline thanh cac thu muc ro rang: `Tu the goc (Base)`, `Dung im (Idle)`, `Chay bo (Run)`, kem nut `+ Them dong tac`.
- **Co che Tai tao tu dong tu Base (Generate / Regenerate from Base)**: Tai moi thu muc dong tac (`idle`, `run`), cung cap nut bam tao nhanh cac frame chuyen dong dua tren du lieu diem anh hien tai cua `Base Pose`.
- **Xem truoc va chinh sua rieng biet**: Khi chuyen giua cac thu muc, canvas chinh va dac biet la bo phat xem truoc (Preview Player) chi lap trong pham vi cac frame cua thu muc dang mo.

---

## 2. Kien Truc Du Lieu (Data Architecture)

### 2.1. Mo Rong Cau Truc Du Lieu trong `packages/shared-types`
Trong `packages/shared-types/src/index.ts`, mo rong cac interface de ho tro luu tru doc lap cac frame theo tung Clip/Dong tac:

```typescript
export interface AnimationClip {
  id: string;
  name: string; // 'base' | 'idle' | 'run' | 'jump' | 'attack' hoac ten tuy chinh
  label?: string; // Nhan hien thi tieng Viet tren giao dien (vi du: 'Tu the goc', 'Dung im')
  fps: number; // Toc do khung hinh (1-60)
  loop: boolean;
  frames: FrameData[]; // Danh sach cac frame thuoc rieng thu muc / dong tac nay
  isBase?: boolean; // Danh dau day la thu muc nhan vat goc (khong the xoa)
}

export interface CanvasProject {
  id: string;
  name: string;
  width: number;
  height: number;
  pivot: Point2D;
  clips: AnimationClip[]; // Danh sach cac thu muc dong tac
  activeClipId: string; // Id cua thu muc dong tac dang mo
  frames: FrameData[]; // Con tro tham chieu den frames cua clip dang kich hoat (giu tuong thich nguoc)
  activeFrameIndex: number;
  activeLayerId: string;
  groups?: LayerGroup[];
}
```

### 2.2. Khoi Tao Du An Mac Dinh (Default Project Initialization)
Khi tao mot du an moi:
1. `clips[0]`: Thu muc `Base Pose` (`id: 'clip_base'`, `name: 'base'`, `label: 'Tu the goc'`, `isBase: true`, `frames: [initialFrame]`).
2. `clips[1]`: Thu muc `Idle` (`id: 'clip_idle'`, `name: 'idle'`, `label: 'Dung im'`, `frames: []`).
3. `clips[2]`: Thu muc `Run` (`id: 'clip_run'`, `name: 'run'`, `label: 'Chay bo'`, `frames: []`).
4. `activeClipId = 'clip_base'`.

Khi nguoi dung ve hoac nhap anh dau tien, anh do duoc luu vao thu muc `Base`.

---

## 3. Thiet Ke Giao Dien Nguoi Dung (UI / UX Design)

### 3.1. Thanh Thu Muc Dong Tac (Action Folders Header) tren Footer
Thanh Footer Timeline duoc chia thanh 2 tang truc quan:
- **Tang 1: Thanh Action Folders Tab Bar**:
  - `[Tab Tu the goc (Base)]`: Icon nhan vat, nhan "Goc", so luong 1 frame.
  - `[Tab Dung im (Idle)]`: Icon dong tac, nhan "Dung im", hien so frame (vi du: `4 frames`).
  - `[Tab Chay bo (Run)]`: Icon buoc chay, nhan "Chay bo", hien so frame (vi du: `4 frames`).
  - `[Nut + Them dong tac]`: Mo popup nhanh tao clip moi (Jump, Attack, Cast Spell, Custom).
- **Tang 2: Thanh Dieu Khien & Dai Frame Cards (Timeline Controls & Frame Strip)**:
  - Cac nut dieu khien: Nut Play/Pause, Nut Prev/Next Frame, Onion Skin, Slider FPS.
  - **Nut "Tao / Tai tao tu Base" (Generate from Base)**: Xuat hien noi bat voi gradient mau xanh luc (emerald) khi nguoi dung dang dung o cac tab dong tac nhu `Idle` hoac `Run`.
  - Dai Frame Cards: Chi hien thi danh sach cac frame thuoc thu muc dang mo.

### 3.2. Co Che Tuong Tac (User Interaction Workflow)
1. **Buoc 1: Ve hoac nhap nhan vat vao Base Pose**:
   - Nguoi dung dang o tab `Tu the goc (Base)`.
   - Nguoi dung ve pixel hoac nhap anh tu may tinh / AI Studio. Day la ban thiet ke goc cua nhan vat.
2. **Buoc 2: Chuyen sang tab Dong tac (vi du `Dung im` hoac `Chay bo`)**:
   - Neu thu muc chua co frame nao, giao dien hien thi thong diep truc quan: "Chua co frame chuyen dong. Nhan nut 'Tao tu Base' de tu dong tao hoat anh tu nhan vat goc".
   - Nguoi dung nhan nut `Tao tu Base`: Studio gui cac pixel goc cua Base Pose sang bo xu ly Template Rigging (tai server hoac engine cuc bo).
   - Chi trong vai mili-giay, bo 4 frame chuyen dong `idle` (hoac `run`) duoc tao ra va nap vao thu muc nay.
   - Trinh phat Preview tu dong phat chuyen dong lap lai de nguoi dung kiem tra nhan vat.
3. **Buoc 3: Chinh sua nhan vat goc va cap nhat lai toan bo dong tac**:
   - Nguoi dung muon doi mau toc, them ao choang hoac sua vu khi: chi can nhan vao tab `Tu the goc (Base)`.
   - Chinh sua diem anh tren canvas.
   - Quay lai tab `Dung im` hoac `Chay bo`, nhan `Tai tao tu Base`: Toan bo cac frame trong thu muc duoc tinh toan lai ngay lap tuc theo mau toc va ao choang moi, giu nguyen su dong nhat 100%.
4. **Buoc 4: Chinh sua thu cong tren tung frame chuyen dong**:
   - Neu muon tinh chinh chi tiet cho rieng frame 2 cua dong tac `Chay bo`, nguoi dung co the chon frame do tren timeline va ve them bot pixel tu do.

---

## 4. Nang Cap Logic Va Module

### 4.1. `AnimationController` (`apps/studio/src/animation/animation-controller.ts`)
- Bo sung cac phuong thuc quan ly thu muc dong tac:
  - `setActiveClipById(clipId: string): void`: Chuyen thu muc hien tai, dong bo `project.frames` tro vao `clip.frames`.
  - `getBaseClip(): AnimationClip`: Lay clip nhan vat goc.
  - `getActiveClip(): AnimationClip`: Lay clip dang mo.
  - `addFolderClip(name: string, label: string): AnimationClip`: Tao thu muc dong tac moi.
  - `removeFolderClip(clipId: string): boolean`: Xoa thu muc dong tac (ngan chan xoa thu muc `base`).
  - `setClipFrames(clipId: string, frames: FrameData[]): void`: Cap nhat toan bo frames cua mot thu muc.

### 4.2. Ket Noi Template Rigging Client-Server (`template-animator.ts`)
- Cung cap ham client `generateActionFromBase(action: 'idle' | 'run' | 'walk' | 'jump' | 'attack')`:
  - Trich xuat tat ca pixel hien co tu layer cua frame trong thu muc `Base`.
  - Goi den server endpoint `/api/template-animate` (hoac chay engine tinh toan xoay khop).
  - Nhan ket qua tra ve la danh sach cac frame diem anh.
  - Gan truc tiep vao `currentClip.frames` va cap nhat `renderTimeline()`, `previewPlayer.play()`.

### 4.3. Xuat va Nhap File Du An `.pxdraw`
- Ham export `.pxdraw` dong goi toan bo mang `clips` gom day du cac thu muc va frame ben trong.
- Ham import `.pxdraw` phuc hoi day du cac thu muc, dam bao khong bi mat nhan vat goc hay bat ky dong tac nao truoc do.

---

## 5. Ke Hoach Kiem Thu (Testing Strategy)

1. **Unit Test cho `AnimationController`**:
   - Kiem tra khoi tao day du 3 thu muc: `base`, `idle`, `run`.
   - Kiem tra tinh bat bien cua `base` (khong bi xoa).
   - Kiem tra chuyen doi giua cac thu muc: frames duoc cach ly doc lap giua cac thu muc.
   - Kiem tra keo tha reorder, them frame, xoa frame trong tung thu muc.
2. **Kiem thu tich hop Giao dien (UI Integration)**:
   - Ve nhan vat tai tab `Base`.
   - Sang tab `Idle`, bam "Tao tu Base", kiem tra 4 frame idle xuat hien, nhan vat tho nhe nhang.
   - Sang tab `Run`, bam "Tao tu Base", kiem tra 4-6 frame run xuat hien, nhan vat chay.
   - Ve lai tab `Base`, doi mau diem anh, quay lai `Run` bam "Tai tao tu Base", kiem tra mau moi duoc ap dung vao toan bo dong tac chay.
3. **Kiem thu Build va Monorepo**:
   - Chay `npm run build` monorepo va `npx vitest run` dam bao 100% build sach khong loi.

---

## 6. Tu Tuan Thu Cac Quy Tac Du An (Compliance Checklist)
- [x] Khong su dung icon hay emoji trong code va van ban.
- [x] Luon binh luan code va giai thich bang tieng Viet co dau.
- [x] Dat ten bien, ham, kieu du lieu bang tieng Anh.
- [x] Khong tu dong chay git commit (`Do not auto commit to git`).
- [x] Khong tao file test ngoai pham vi duoc phep.

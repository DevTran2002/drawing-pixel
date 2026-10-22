# LPC Keyframe Concept va Motion Transfer Implementation Plan

Ke hoach trien khai Phuong an 2: Sang tao trang phuc tu mot Frame mau (Keyframe) va Chuyen giao chuyen dong sang toan bo chuoi hoat canh LPC 64x64.

## Muc tieu
- Cho phep nguoi dung nhap Prompt de AI sang tao trang phuc / vu khi / hoa van moi tren mot Khung hinh mau duy nhat (Keyframe).
- Khi nguoi dung ung y ban thiet ke mau, he thong se khoa co dinh Seed, dac trung mau sac va chuyen giao sang toan bo 9 khung hinh buoc di theo khung xuong LPC.
- Dam bao su sang tao tu do nhung van giu nguyen 100% tinh pixel-perfect va nhip chuyen dong khong bi rung lac.

## Danh sach cac tep can xu ly
1. `apps/server/src/server.ts`: Bo sung 2 endpoint API:
   - `POST /api/ai/lpc-keyframe-concept`: Nhan 1 frame anh, prompt, strength de sinh nhanh anh concept mau kem seed.
   - `POST /api/ai/lpc-motion-transfer`: Nhan concept mau da duyet, seed, dai strip khung xuong va thuc hien sinh toan bo cac frame hoat canh dong bo.
2. `apps/server/src/ai-helper.ts`:
   - Ham `generateKeyframeConcept`: Goi Python de sinh anh concept tren 1 frame duy nhat.
   - Ham `transferMotionFromKeyframe`: Goi Python de sinh dong bo tren toan bo dai strip khung xuong bang Seed va Prompt cua Keyframe.
3. `apps/studio/src/lpc/lpc-studio-modal.ts`:
   - Xay dung giao dien khu vuc "AI Keyframe Studio" gom:
     + Chon Keyframe goc.
     + O nhap Prompt sang tao va nut goi y phong cach (Cyberpunk, Dragon Knight, Dark Sorcerer...).
     + Thanh truot do sang tao Strength (0.35 - 0.70).
     + Khung hien thi xem truoc mau thu (Preview Keyframe).
     + Nut "Thu lai mau khac" va "Duyet & Chuyen giao chuyen dong".
     + Khung xem truoc hoat canh chuyen dong thoi gian thuc sau khi chuyen giao xong.
4. `apps/studio/styles/main.css`:
   - Bo sung style CSS cho panel AI Keyframe Studio, cac the chon, thanh tien trinh va khung xem truoc.

## Cac buoc thuc hien chi tiet

- [ ] Task 1: Xay dung ham xu ly AI va API Backend cho Keyframe Concept va Motion Transfer
  - Cap nhat `apps/server/src/ai-helper.ts` voi hai ham xu ly chuyen biet.
  - Cap nhat `apps/server/src/server.ts` de tiep nhan hai endpoint POST.
  - Kiem tra ket noi va du lieu tra ve.

- [ ] Task 2: Xay dung giao dien "AI Keyframe Studio" trong LPC Studio Modal
  - Cap nhat `apps/studio/src/lpc/lpc-studio-modal.ts` them khu vuc dieu khien Keyframe Concept.
  - Ket noi su kien bam nut sinh mau thu voi endpoint `/api/ai/lpc-keyframe-concept`.
  - Hien thi anh concept va seed len giao dien.

- [ ] Task 3: Tich hop tinh nang Chuyen giao chuyen dong (Motion Transfer)
  - Ket noi su kien "Duyet & Chuyen giao chuyen dong" voi endpoint `/api/ai/lpc-motion-transfer`.
  - Dong goi dai strip khung xuong tu Compositor va gui len server.
  - Nhan ket qua 9 frame hoat canh va nap thang vao bo phat hoat hinh (Preview Animation Player) trong modal.

- [ ] Task 4: Chinh sua CSS va kiem tra toan dien he thong
  - Cap nhat `apps/studio/styles/main.css` tao giao dien hien dai, ro rang.
  - Kiem tra quy trinh sinh concept 1 frame va chuyen giao sang 9 frame hoat canh.

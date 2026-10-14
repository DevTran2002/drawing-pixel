# Phong Cách Hoạt Cảnh Đồ Vật & Hiệu Ứng Vi Mô (Animated Items & Micro FX)

Đúc kết từ chuỗi mod hoạt cảnh vi mô: Animated Fish, Animated Food & Drinks, Animated Furniture, Cuter Slimes Refreshed.

## 1. Nguyên Lý Chuyển Động Vi Mô (Subtle Pixel Animation)
- Không dịch chuyển toàn bộ sprite quá lớn (sẽ gây giật mắt hoặc phá vỡ tỷ lệ pixel).
- Chỉ dịch chuyển cục bộ từ 1 đến 2 pixel qua từng khung hình (frame-by-frame offset).
- Độ dài vòng lặp chuẩn (Loop duration): 2 frame (nhấp nháy cơ bản), 4 frame (nhịp thở, bơi lội), 6-8 frame (chảy nước, bốc khói).

## 2. Các Kiểu Hoạt Cảnh Tiêu Biểu
- **Cá bơi (Animated Fish - 4 frames):**
  - Khung 1: Thân thẳng tự nhiên.
  - Khung 2: Đuôi uốn nhẹ sang trái 1px, vây lưng nâng lên.
  - Khung 3: Đuôi trở về giữa, thân phồng nhẹ.
  - Khung 4: Đuôi uốn nhẹ sang phải 1px, vây hạ xuống.
- **Thức ăn bốc khói / Đồ uống sủi bọt (Hot Food & Bubbling):**
  - Khói: 2-3 cụm pixel xám trắng `#e8e8e8` bay lên theo hình zíc-zắc và tan dần (giảm độ đậm).
  - Bọt khí: Chấm pixel sáng nổi từ đáy cốc lên mặt nước rồi vỡ.
- **Vàng bạc & Đá quý lấp lánh (Gem Shimmer - 4 frames):**
  - Dịch chuyển 1 vệt sáng trắng (Highlight flash) chạy chéo từ góc trên bên trái sang góc dưới bên phải mặt cắt tinh thể.
- **Quái vật Slime phập phồng (Slime Bounce - 4 frames):**
  - Khung 1 (Đứng yên): Thể tích chuẩn.
  - Khung 2 (Nén xuống): Chiều cao giảm 2px, chiều rộng bè ra hai bên mỗi bên 1px (Squash).
  - Khung 3 (Nảy lên): Chiều cao kéo dài thêm 2px, chiều rộng thu hẹp (Stretch).
  - Khung 4 (Hạ cánh): Trở về kích thước chuẩn.

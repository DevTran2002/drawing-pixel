# Phong Cách Chân Dung Đối Thoại Mở Rộng (Expanded NPC Portraits)

Phong cách chân dung hộp thoại kích thước chuẩn 64x64 pixel cho các tựa game RPG và visual novel 16-bit chi tiết cao.

## 1. Thông Số Lưới Và Bố Cục
- **Kích thước mỗi khung hình biểu cảm:** 64x64 pixel.
- **Tấm hình chân dung đầy đủ (Spritesheet):** Thường xếp thành 2 cột x N hàng (128x320 pixel cho 5 biểu cảm; 128x384 cho 6 biểu cảm).
- **Các biểu cảm chuẩn:**
  1. Bình thường (Neutral / Default smile)
  2. Vui mừng / Cười tươi (Happy / Grinning)
  3. Buồn bã / Trầm tư (Sad / Pensive)
  4. Ngạc nhiên / Sửng sốt (Surprised / Shocked)
  5. Giận dữ / Khó chịu (Angry / Annoyed)
  6. Ngại ngùng / Đỏ mặt (Blushing / Shy)

## 2. Đặc Trưng Nghệ Thuật
- **Khuôn mặt & Tóc:**
  - Đầu nghiêng nhẹ 3/4 sang trái hoặc phải (không nhìn trực diện phẳng lì).
  - Tóc được chia thành các lọn lớn (hair clumps), mỗi lọn có dải chuyển từ 3 đến 5 màu tạo độ mượt và phản chiếu ánh sáng.
  - Mắt có tròng đen, tròng màu và điểm lóe sáng trắng 1px ở góc trên cùng.
- **Áo & Trang sức:**
  - Cổ áo, khăn choàng hoặc giáp vai chiếm 1/3 phần dưới của khung 64x64.
  - Nếp gấp vải (fabric folds) được nhấn bằng các vệt bóng đổ cong mềm mại.
- **Quy tắc viền chân dung:**
  - Viền ngoài cơ thể dùng tone mận chín sẫm `#2d1624` hoặc nâu đất `#3a2010`.
  - Không viền đen 100% để chân dung hòa nhập tự nhiên vào khung hộp thoại gỗ vàng của game.

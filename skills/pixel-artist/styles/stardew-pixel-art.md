# Hồ Sơ Phong Cách: Stardew Pixel Art (16-Bit Cozy Farming & Top-down RPG)

Tạo tài nguyên đồ họa pixel 16-bit phong cách ấm cúng (cozy), hoạt cảnh đa khung hình (sprite sheets) và mã tích hợp game engine theo thẩm mỹ kinh điển của Stardew Valley.

## 1. Khi Nào Nên Sử Dụng
- Người dùng yêu cầu tạo tài nguyên đồ họa pixel cho game thể loại nông trại (farming), mô phỏng đời sống (life-sim) hoặc nhập vai 2D nhẹ nhàng (vật nuôi, nông sản, nhân vật, công trình, nông cụ, biểu tượng hoặc bộ ô đất tileset).
- Người dùng yêu cầu hoạt cảnh sprite sheet đa khung hình (bước đi, nhịp thở, gà mổ thóc, chạy, các giai đoạn phát triển của cây trồng).
- Cần sự đồng bộ nhất quán về mặt thị giác trên toàn bộ dự án.

## 2. Quy Chuẩn Thẩm Mỹ Thị Giác (Visual Style Guidelines)

- **Góc nhìn không gian (Perspective):** Góc nhìn chéo từ trên xuống Top-down 3/4 chuẩn RPG cổ điển (mặt trước và mặt trên của vật thể hiển thị đồng thời, không dùng phối cảnh tụ xa gần).
- **Lưới kích thước và Tỷ lệ (Grid & Proportions):**
  - Biểu tượng, hạt giống, công cụ và vật phẩm nhỏ: Lưới 16x16 px.
  - Nhân vật và cây trồng cao: Lưới 16x32 px (tỷ lệ chibi dễ thương, đầu biểu cảm rõ nét, dáng đứng dễ nhận diện).
  - Vật nuôi nông trại và đạo cụ lớn: Lưới 32x32 px hoặc 64x64 px.
- **Đường viền (Selective Outlining / Sel-out):**
  - Sử dụng viền 1 pixel bằng màu nâu ấm sẫm (#3A2010), màu mận chín sẫm hoặc phiên bản màu tối hơn của mảng tiếp giáp.
  - Tránh sử dụng viền đen tuyền (#000000) trên các đối tượng hữu cơ (cây cối, động vật) để hình vẽ hòa sắc mềm mại với khung nền.
- **Bảng màu và Đổ bóng (Color Palette & Shading):**
  - Gam màu ấm áp, tự nhiên, hơi dịu mắt dưới ánh nắng mặt trời (sunlit palette).
  - Áp dụng kỹ thuật dịch chuyển sắc tướng (Hue-shifting): Vùng sáng (highlight) dịch về tông vàng/cam ấm, vùng bóng đổ (shadow) dịch về tím/xanh lạnh hoặc nâu đỏ trầm.
  - Đổ bóng theo mảng cụm sạch sẽ (Cluster shading, từ 2 đến 4 mức màu cho mỗi dải). Tránh dùng họa tiết dither caro hạt dày đặc trên các sprite kích thước nhỏ.
- **Khung nền:** Khi xuất dải ảnh sprite sheet, đặt trên nền màu be sáng (#E8E2D5) hoặc nền trong suốt có khoảng cách rõ ràng giữa các frame để dễ dàng cắt ghép.

## 3. Các Bước Thực Hiện Cụ Thể

### Bước 1: Xác Định Loại Tài Nguyên Và Bố Cục Sprite Sheet
- **Vật phẩm đơn lẻ / Gói tài nguyên tổng hợp:** Sắp xếp các vật phẩm liên quan (vật nuôi, nông sản, công cụ) thành các hàng ngang gọn gàng kèm khoảng đệm đồng đều.
- **Hoạt cảnh nhân vật / Vật nuôi:** Sắp xếp tuần tự từ trái sang phải (ví dụ chu kỳ 4 frame hoặc 8 frame). Đảm bảo thể tích nhân vật, độ dày nét viền và đường bóng tiếp đất giữ nguyên vị trí.
- **Các giai đoạn sinh trưởng của cây trồng (Crop Growth):** Thường chia thành 4 đến 5 giai đoạn ngang:
  1. Hạt giống mới gieo / mầm non nhú trên luống đất cày.
  2. Thân cây non có lá xanh.
  3. Cây trưởng thành bắt đầu ra nụ hoặc trổ hoa.
  4. Cây chín rộ trĩu quả hoặc trĩu hạt sẵn sàng thu hoạch.

### Bước 2: Bảng Màu Tiêu Biểu Cho Phong Cách Stardew
- Viền nâu ấm: #3a2010
- Đất cày & Gỗ: #523624, #945b3a, #b87b4e, #deb887
- Cây cỏ & Lá: #1e3f20, #386b2e, #5c9e3d, #8fcf4f
- Nắng & Trái cây chín: #8b3a1a, #d95726, #f29e38, #fce068
- Nước & Bầu trời: #1d3354, #365b8c, #5b8dbf, #9dc4e8
- Nền be sáng: #e8e2d5

### Bước 3: Tích Hợp Game Engine (Phaser 3 / Web Canvas)
- Khi nạp vào game engine, luôn bật chế độ `pixelArt: true` (hoặc cấu hình WebGL filter `NEAREST`) để hình ảnh luôn sắc nét và không bị nội suy mờ nhòe.
